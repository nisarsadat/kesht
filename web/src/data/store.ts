import {
  addMember,
  closeRound,
  createId,
  createKesht,
  joinMember,
  moveMember,
  removeMember,
  setPaid,
  setRecipient,
  startKesht,
  updateMember,
} from '../domain/rules';
import type { Bundle, CreateKeshtInput, KeshtSummary, Language, MemberInput } from '../domain/types';
import type { ThemeName } from '../lib/theme';
import { assembleBundles, keshtPayload, memberPayload, paymentPayload, roundPayload } from './mappers';
import { supabase } from './supabase';

/**
 * The app's data store.
 *
 * Its public API is deliberately *synchronous*: every page reads a bundle and
 * runs a rule through the pure reducers in domain/rules.ts with plain function
 * calls, so the rules engine stays the single source of truth for what a valid
 * change is.
 *
 * On the real database that means each change is applied locally first (so the
 * UI reacts immediately), then written to Supabase as one atomic call. If the
 * write fails, the store reloads from the server — the optimistic change
 * disappears and the reason is exposed through getLastError().
 *
 * Without credentials (development only) everything is kept in this browser
 * under the same key the phone app's web build uses, so the UI still works.
 */

/** Local-only storage, shared with the phone app's web build. */
const LOCAL_KEY = 'kesht.web.v1';
/** Language and theme for the cloud build; these are per-device preferences. */
const PREFS_KEY = 'kesht.prefs.v1';
/** Remembers that this browser's local data has already been offered for import. */
const IMPORTED_KEY = 'kesht.imported.v1';

export type Mode = 'cloud' | 'local';
export type Role = 'owner' | 'viewer';

type Prefs = { language: Language; theme: ThemeName };

type LocalState = {
  language?: Language;
  theme?: ThemeName;
  bundles?: Record<string, Bundle>;
};

function readLocal(): LocalState {
  try {
    const raw = globalThis.localStorage?.getItem(LOCAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LocalState | null;
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      language: parsed.language === 'en' ? 'en' : 'fa',
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      bundles: parsed.bundles && typeof parsed.bundles === 'object' ? parsed.bundles : {},
    };
  } catch {
    return {};
  }
}

function readPrefs(): Prefs {
  try {
    const raw = globalThis.localStorage?.getItem(PREFS_KEY);
    if (!raw) return { language: 'fa', theme: 'light' };
    const parsed = JSON.parse(raw) as Partial<Prefs> | null;
    return {
      language: parsed?.language === 'en' ? 'en' : 'fa',
      theme: parsed?.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return { language: 'fa', theme: 'light' };
  }
}

function reason(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  return String(caught);
}

export class KeshtStore {
  readonly mode: Mode = supabase ? 'cloud' : 'local';

  private bundles: Record<string, Bundle> = {};
  private roles: Record<string, Role> = {};
  private prefs: Prefs = { language: 'fa', theme: 'light' };
  private userId: string | null = null;
  private loaded = false;
  private lastError: string | null = null;
  /** Data left in this browser by the local-only build, offered for import once. */
  private localBundles: Record<string, Bundle> | null = null;
  private listeners = new Set<() => void>();
  private revision = 0;

  constructor() {
    if (this.mode === 'local') {
      const local = readLocal();
      this.bundles = local.bundles ?? {};
      this.prefs = { language: local.language ?? 'fa', theme: local.theme === 'dark' ? 'dark' : 'light' };
      this.loaded = true;
    } else {
      this.prefs = readPrefs();
      this.localBundles = readLocal().bundles ?? {};
    }

    globalThis.addEventListener?.('storage', (event) => {
      if (event.key && event.key !== LOCAL_KEY && event.key !== PREFS_KEY) return;
      if (this.mode === 'local') {
        const local = readLocal();
        this.bundles = local.bundles ?? {};
        this.prefs = { language: local.language ?? 'fa', theme: local.theme === 'dark' ? 'dark' : 'light' };
      } else {
        this.prefs = readPrefs();
      }
      this.emit();
    });
  }

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getRevision = (): number => this.revision;

  private emit(): void {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }

  private save(): void {
    try {
      if (this.mode === 'local') {
        globalThis.localStorage?.setItem(
          LOCAL_KEY,
          JSON.stringify({ language: this.prefs.language, theme: this.prefs.theme, bundles: this.bundles }),
        );
      } else {
        globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(this.prefs));
      }
    } catch {
      // Storage full or blocked (private mode). The in-memory state keeps working.
    }
  }

  private fail(message: string): void {
    this.lastError = message;
    this.emit();
  }

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  getLanguage(): Language {
    return this.prefs.language === 'en' ? 'en' : 'fa';
  }

  setLanguage(language: Language): void {
    this.prefs.language = language;
    this.save();
    this.emit();
  }

  getTheme(): ThemeName {
    return this.prefs.theme === 'dark' ? 'dark' : 'light';
  }

  setTheme(theme: ThemeName): void {
    this.prefs.theme = theme;
    this.save();
    this.emit();
  }

  // -------------------------------------------------------------------------
  // Session and loading
  // -------------------------------------------------------------------------

  isCloud(): boolean {
    return this.mode === 'cloud';
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  clearLastError(): void {
    if (this.lastError === null) return;
    this.lastError = null;
    this.emit();
  }

  roleOf(keshtId: string): Role | null {
    return this.roles[keshtId] ?? null;
  }

  /** The local-only build has no accounts, so everything is editable there. */
  canEdit(keshtId: string): boolean {
    return this.mode === 'local' || this.roles[keshtId] === 'owner';
  }

  /** Loads everything this account can see and claims any pending email invite. */
  async attach(userId: string): Promise<void> {
    this.userId = userId;
    this.loaded = false;
    this.lastError = null;
    this.emit();
    try {
      const { error } = await supabase!.rpc('claim_pending_invites');
      if (error) throw error;
      await this.loadAll();
    } catch (caught) {
      this.fail(reason(caught));
      this.loaded = true;
      this.emit();
    }
  }

  detach(): void {
    this.userId = null;
    this.bundles = {};
    this.roles = {};
    this.loaded = false;
    this.lastError = null;
    this.emit();
  }

  async refresh(): Promise<void> {
    // Nothing to refresh when running locally or before an account is attached
    // (a signed-out visitor should not be querying the database at all).
    if (this.mode === 'local' || !this.userId) return;
    try {
      await this.loadAll();
    } catch (caught) {
      this.fail(reason(caught));
    }
  }

  private async loadAll(): Promise<void> {
    const client = supabase;
    if (!client) return;
    // Row level security narrows every one of these to the keshts this account
    // belongs to, so there are no id lists to keep in step.
    const [keshts, members, rounds, payments, memberships] = await Promise.all([
      client.from('keshts').select('*'),
      client.from('members').select('*'),
      client.from('rounds').select('*'),
      client.from('payments').select('*'),
      client.from('kesht_members').select('kesht_id, role').eq('user_id', this.userId ?? ''),
    ]);
    const error = keshts.error ?? members.error ?? rounds.error ?? payments.error ?? memberships.error;
    if (error) throw error;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    this.bundles = assembleBundles(
      (keshts.data ?? []) as any,
      (members.data ?? []) as any,
      (rounds.data ?? []) as any,
      (payments.data ?? []) as any,
    );
    const roles: Record<string, Role> = {};
    for (const row of (memberships.data ?? []) as { kesht_id: string; role: string }[]) {
      roles[row.kesht_id] = row.role === 'owner' ? 'owner' : 'viewer';
    }
    this.roles = roles;

    this.loaded = true;
    this.emit();
  }

  // -------------------------------------------------------------------------
  // Reading
  // -------------------------------------------------------------------------

  listKeshts(): KeshtSummary[] {
    return Object.values(this.bundles)
      .sort((a, b) => b.kesht.updatedAt.localeCompare(a.kesht.updatedAt))
      .map((bundle) => ({
        id: bundle.kesht.id,
        name: bundle.kesht.name,
        monthlyAmount: bundle.kesht.monthlyAmount,
        status: bundle.kesht.status,
        memberCount: bundle.members.length,
        openSequence: bundle.rounds.find((round) => round.status === 'open')?.sequence ?? null,
      }));
  }

  getBundle(keshtId: string): Bundle | null {
    return this.bundles[keshtId] ?? null;
  }

  // -------------------------------------------------------------------------
  // Writing
  // -------------------------------------------------------------------------

  private async saveBundle(bundle: Bundle): Promise<void> {
    const client = supabase;
    if (!client) return;
    const { error } = await client.rpc('save_kesht_bundle', {
      p_kesht: keshtPayload(bundle.kesht),
      p_members: bundle.members.map(memberPayload),
      p_rounds: bundle.rounds.map(roundPayload),
      p_payments: bundle.payments.map(paymentPayload),
    });
    if (!error) return;
    this.fail(error.message);
    // Drop the optimistic change so the screen matches the database again.
    await this.refresh();
  }

  private mutate(keshtId: string, change: (bundle: Bundle) => Bundle): void {
    const bundle = this.bundles[keshtId];
    if (!bundle) throw new Error('kesht_not_found');
    const next = change(bundle);
    if (next === bundle) return;
    this.bundles[keshtId] = next;
    this.save();
    this.emit();
    void this.saveBundle(next);
  }

  createKesht(input: CreateKeshtInput): string {
    const now = new Date().toISOString();
    const kesht = createKesht(input, now, createId());
    const bundle: Bundle = { kesht, members: [], rounds: [], payments: [] };
    this.bundles[kesht.id] = bundle;
    // The database adds the owner membership by trigger; mirror it here so the
    // new kesht is editable straight away.
    if (this.mode === 'cloud') this.roles[kesht.id] = 'owner';
    this.save();
    this.emit();
    void this.saveBundle(bundle);
    return kesht.id;
  }

  addMember(keshtId: string, input: MemberInput): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => addMember(bundle, input, now, createId()));
  }

  joinMember(keshtId: string, input: MemberInput): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => joinMember(bundle, input, now, createId(), createId));
  }

  updateMember(keshtId: string, memberId: string, input: MemberInput): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => updateMember(bundle, memberId, input, now));
  }

  removeMember(keshtId: string, memberId: string): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => removeMember(bundle, memberId, now));
  }

  moveMember(keshtId: string, memberId: string, direction: 'up' | 'down'): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => moveMember(bundle, memberId, direction, now));
  }

  startKesht(keshtId: string): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => startKesht(bundle, now, createId));
  }

  setPaid(keshtId: string, paymentId: string, paid: boolean): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => setPaid(bundle, paymentId, paid, now));
  }

  setAllPaid(keshtId: string, paid: boolean): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => {
      const open = bundle.rounds.find((round) => round.status === 'open');
      if (!open) return bundle;
      return bundle.payments
        .filter((payment) => payment.roundId === open.id)
        .reduce((current, payment) => setPaid(current, payment.id, paid, now), bundle);
    });
  }

  setRecipient(keshtId: string, memberId: string): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => setRecipient(bundle, memberId, now));
  }

  closeRound(keshtId: string): void {
    const now = new Date().toISOString();
    this.mutate(keshtId, (bundle) => closeRound(bundle, now, createId));
  }

  // -------------------------------------------------------------------------
  // One-time import of data left behind by the local-only build
  // -------------------------------------------------------------------------

  hasLocalData(): boolean {
    if (this.mode !== 'cloud') return false;
    if (globalThis.localStorage?.getItem(IMPORTED_KEY)) return false;
    return Object.keys(this.localBundles ?? {}).length > 0;
  }

  localDataCount(): number {
    return Object.keys(this.localBundles ?? {}).length;
  }

  dismissLocalImport(): void {
    try {
      globalThis.localStorage?.setItem(IMPORTED_KEY, new Date().toISOString());
    } catch {
      // Nothing to do; the prompt will simply show again next time.
    }
    this.emit();
  }

  /** Copies this browser's local keshts into the account. Returns how many made it. */
  async importLocalData(): Promise<number> {
    const bundles = Object.values(this.localBundles ?? {});
    if (this.mode !== 'cloud' || bundles.length === 0) return 0;
    let imported = 0;
    for (const bundle of bundles) {
      const client = supabase;
      if (!client) break;
      const { error } = await client.rpc('save_kesht_bundle', {
        p_kesht: keshtPayload(bundle.kesht),
        p_members: bundle.members.map(memberPayload),
        p_rounds: bundle.rounds.map(roundPayload),
        p_payments: bundle.payments.map(paymentPayload),
      });
      if (error) {
        this.fail(error.message);
        break;
      }
      imported += 1;
    }
    if (imported === bundles.length) this.dismissLocalImport();
    await this.refresh();
    return imported;
  }
}

export const store = new KeshtStore();
