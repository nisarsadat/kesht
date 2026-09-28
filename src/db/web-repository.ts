import {
  addMember,
  joinMember,
  closeRound,
  createId,
  createKesht,
  moveMember,
  removeMember,
  setPaid,
  setRecipient,
  startKesht,
  updateMember,
} from '../domain/rules';
import type { Bundle, CreateKeshtInput, KeshtSummary, Language, MemberInput } from '../domain/types';
import type { ThemeName } from '../theme';

const STORAGE_KEY = 'kesht.web.v1';

type WebState = {
  language: Language;
  theme?: ThemeName;
  bundles: Record<string, Bundle>;
};

function emptyState(): WebState {
  return { language: 'fa', theme: 'dark', bundles: {} };
}

export class WebKeshtRepository {
  private state: WebState;

  constructor() {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    this.state = raw ? (JSON.parse(raw) as WebState) : emptyState();
  }

  private save(): void {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  async getLanguage(): Promise<Language> {
    return this.state.language === 'en' ? 'en' : 'fa';
  }

  async setLanguage(language: Language): Promise<void> {
    this.state.language = language;
    this.save();
  }

  async getTheme(): Promise<ThemeName> {
    return this.state.theme === 'light' ? 'light' : 'dark';
  }

  async setTheme(theme: ThemeName): Promise<void> {
    this.state.theme = theme;
    this.save();
  }

  async listKeshts(): Promise<KeshtSummary[]> {
    return Object.values(this.state.bundles)
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

  async getBundle(keshtId: string): Promise<Bundle | null> {
    return this.state.bundles[keshtId] ?? null;
  }

  async createKesht(input: CreateKeshtInput): Promise<string> {
    const now = new Date().toISOString();
    const kesht = createKesht(input, now, createId());
    this.state.bundles[kesht.id] = { kesht, members: [], rounds: [], payments: [] };
    this.save();
    return kesht.id;
  }

  private async mutate(keshtId: string, change: (bundle: Bundle) => Bundle): Promise<void> {
    const bundle = this.state.bundles[keshtId];
    if (!bundle) throw new Error('kesht_not_found');
    this.state.bundles[keshtId] = change(bundle);
    this.save();
  }

  addMember(keshtId: string, input: MemberInput): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => addMember(bundle, input, now, createId()));
  }

  joinMember(keshtId: string, input: MemberInput): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => joinMember(bundle, input, now, createId(), createId));
  }

  updateMember(keshtId: string, memberId: string, input: MemberInput): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => updateMember(bundle, memberId, input, now));
  }

  removeMember(keshtId: string, memberId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => removeMember(bundle, memberId, now));
  }

  moveMember(keshtId: string, memberId: string, direction: 'up' | 'down'): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => moveMember(bundle, memberId, direction, now));
  }

  startKesht(keshtId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => startKesht(bundle, now, createId));
  }

  setPaid(keshtId: string, paymentId: string, paid: boolean): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => setPaid(bundle, paymentId, paid, now));
  }

  setAllPaid(keshtId: string, paid: boolean): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => {
      const open = bundle.rounds.find((round) => round.status === 'open');
      if (!open) return bundle;
      return bundle.payments
        .filter((payment) => payment.roundId === open.id)
        .reduce((current, payment) => setPaid(current, payment.id, paid, now), bundle);
    });
  }

  setRecipient(keshtId: string, memberId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => setRecipient(bundle, memberId, now));
  }

  closeRound(keshtId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.mutate(keshtId, (bundle) => closeRound(bundle, now, createId));
  }
}
