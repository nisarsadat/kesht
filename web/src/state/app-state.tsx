import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fetchIsAdmin } from '../data/admin';
import { store, type Mode, type Role } from '../data/store';
import { isCloudConfigured, supabase } from '../data/supabase';
import type { Bundle, KeshtSummary, Language, RuleCode } from '../domain/types';
import { KeshtRuleError } from '../domain/types';
import { ruleMessage, translate, type MessageKey } from '../i18n/messages';
import { paletteFor, type Palette, type ThemeName } from '../lib/theme';

type AppState = {
  /** 'cloud' on Supabase, 'local' when running without credentials in dev. */
  mode: Mode;
  /** False when a production build has no Supabase credentials. */
  configured: boolean;
  session: Session | null;
  authReady: boolean;
  email: string | null;
  /** True when the signed-in account is the super admin (a row in app_admins). */
  isAdmin: boolean;
  loadingData: boolean;
  language: Language;
  direction: 'rtl' | 'ltr';
  theme: ThemeName;
  colors: Palette;
  /** Bumped whenever stored data changes, so views re-read the store. */
  revision: number;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  errorFrom: (caught: unknown, fallback: MessageKey) => string;
  /** Same as errorFrom, but for sign-in and password failures. */
  authErrorFrom: (caught: unknown) => string;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeName) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  roleOf: (keshtId: string) => Role | null;
  /** Only the owner of a kesht may change it; everyone else is read-only. */
  canEdit: (keshtId: string) => boolean;
  lastError: string | null;
  clearLastError: () => void;
  hasLocalData: boolean;
  localDataCount: number;
  importLocalData: () => Promise<number>;
  dismissLocalImport: () => void;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

/** Turns Supabase's English auth failures into something people can read. */
function authMessageKey(message: string): MessageKey | null {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'authInvalid';
  if (text.includes('already registered') || text.includes('already been registered')) return 'authExists';
  if (text.includes('email not confirmed')) return 'authUnconfirmed';
  if (text.includes('at least 6 characters') || text.includes('password should be')) return 'authWeakPassword';
  if (text.includes('rate limit') || text.includes('too many')) return 'authRateLimited';
  if (text.includes('invalid format') || text.includes('invalid email')) return 'emailInvalid';
  if (text.includes('not_authenticated')) return 'notAuthenticated';
  // Browser-level failures arrive as "Failed to fetch" / "Load failed".
  if (text.includes('failed to fetch') || text.includes('load failed') || text.includes('network')) {
    return 'networkError';
  }
  return null;
}

function messageOf(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  if (typeof caught === 'string') return caught;
  return '';
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const revision = useSyncExternalStore(store.subscribe, store.getRevision, store.getRevision);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const attached = useRef<string | null>(null);

  const language = store.getLanguage();
  const theme = store.getTheme();

  useEffect(() => {
    const client = supabase;
    if (!client) {
      // Local-only build: there is no account to wait for.
      setAuthReady(true);
      return;
    }
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setAuthReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const userId = session?.user.id ?? null;
    if (userId === attached.current) return;
    attached.current = userId;
    if (userId) void store.attach(userId);
    else store.detach();
    // Resolved once per identity change; signing out clears it immediately.
    let active = true;
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    void fetchIsAdmin()
      .then((admin) => {
        if (active) setIsAdmin(admin);
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      });
    return () => {
      active = false;
    };
  }, [session]);

  // Kept separate from the value below so their identity only changes when the
  // language does: pages put them in effect dependencies, and the store emits
  // on every change, which would otherwise loop.
  const helpers = useMemo(() => {
    const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(language, key, vars);
    const authErrorFrom = (caught: unknown): string => {
      const raw = messageOf(caught);
      const key = raw ? authMessageKey(raw) : null;
      return key ? translate(language, key) : raw || translate(language, 'networkError');
    };
    const errorFrom = (caught: unknown, fallback: MessageKey): string =>
      caught instanceof KeshtRuleError ? ruleMessage(language, caught.code) : translate(language, fallback);
    return { t, authErrorFrom, errorFrom };
  }, [language]);

  // Bound straight to the store or the auth client, so these never need a new
  // identity; using them in an effect dependency stays safe.
  const actions = useMemo(
    () => ({
      setLanguage: (next: Language) => store.setLanguage(next),
      setTheme: (next: ThemeName) => store.setTheme(next),
      roleOf: (keshtId: string) => store.roleOf(keshtId),
      canEdit: (keshtId: string) => store.canEdit(keshtId),
      clearLastError: () => store.clearLastError(),
      dismissLocalImport: () => store.dismissLocalImport(),
      importLocalData: () => store.importLocalData(),
      refresh: () => store.refresh(),
      signIn: async (email: string, password: string) => {
        const client = supabase;
        if (!client) return;
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message);
      },
      signUp: async (email: string, password: string) => {
        const client = supabase;
        if (!client) return { needsConfirmation: false };
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          // Where the confirmation link comes back to.
          options: { emailRedirectTo: globalThis.location?.origin ?? undefined },
        });
        if (error) throw new Error(error.message);
        // No session straight after signing up means confirmation is required.
        return { needsConfirmation: data.session === null };
      },
      signOut: async () => {
        const client = supabase;
        if (!client) return;
        const { error } = await client.auth.signOut();
        if (error) throw new Error(error.message);
      },
      sendPasswordReset: async (email: string) => {
        const client = supabase;
        if (!client) return;
        const origin = globalThis.location?.origin ?? '';
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${origin}/reset-password`,
        });
        if (error) throw new Error(error.message);
      },
      updatePassword: async (password: string) => {
        const client = supabase;
        if (!client) return;
        const { error } = await client.auth.updateUser({ password });
        if (error) throw new Error(error.message);
      },
    }),
    [],
  );

  const value = useMemo<AppState>(() => {
    return {
      ...helpers,
      ...actions,
      mode: store.mode,
      configured: isCloudConfigured,
      session,
      authReady,
      email: session?.user.email ?? null,
      isAdmin,
      loadingData: !store.isLoaded(),
      language,
      direction: language === 'fa' ? 'rtl' : 'ltr',
      theme,
      colors: paletteFor(theme),
      revision,
      lastError: store.getLastError(),
      hasLocalData: store.hasLocalData(),
      localDataCount: store.localDataCount(),
    };
  }, [helpers, actions, theme, revision, session, authReady, isAdmin]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppStateProvider missing');
  return value;
}

/** Live view of one kesht, re-read on every store change. */
export function useBundle(keshtId: string | undefined): Bundle | null {
  const { revision } = useApp();
  return useMemo(() => (keshtId ? store.getBundle(keshtId) : null), [keshtId, revision]);
}

/** Live view of the kesht list. */
export function useSummaries(): KeshtSummary[] {
  const { revision } = useApp();
  return useMemo(() => store.listKeshts(), [revision]);
}

/** Re-reads the store whenever the window regains focus. */
export function useRefreshOnFocus(): void {
  const refresh = useCallback(() => {
    void store.refresh();
  }, []);
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    globalThis.addEventListener?.('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      globalThis.removeEventListener?.('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);
}

export type { RuleCode };
