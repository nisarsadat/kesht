import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { isCloudConfigured, neon } from '../data/neon';
import { store, type Mode, type Role } from '../data/store';
import type { Bundle, KeshtSummary, Language, RuleCode } from '../domain/types';
import { KeshtRuleError } from '../domain/types';
import { ruleMessage, translate, type MessageKey } from '../i18n/messages';
import { paletteFor, type Palette, type ThemeName } from '../lib/theme';

/** Minimal session shape the UI needs. The Neon adapter returns a fuller object. */
type Session = { user: { id: string; email?: string | null } } | null;

type AppState = {
  /** 'cloud' on Neon, 'local' when running without credentials in dev. */
  mode: Mode;
  /** False when a production build has no Neon credentials. */
  configured: boolean;
  session: Session | null;
  authReady: boolean;
  email: string | null;
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
  resetPassword: (token: string, password: string) => Promise<void>;
  roleOf: (keshtId: string) => Role | null;
  /** The owner and managers may change a kesht; members only look. */
  canEdit: (keshtId: string) => boolean;
  /** Only the owner decides who has access to a kesht. */
  canManage: (keshtId: string) => boolean;
  lastError: string | null;
  clearLastError: () => void;
  hasLocalData: boolean;
  localDataCount: number;
  importLocalData: () => Promise<number>;
  dismissLocalImport: () => void;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

/** Turns auth failures into something people can read. */
function authMessageKey(message: string): MessageKey | null {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials') || text.includes('invalid email or password')) return 'authInvalid';
  if (text.includes('already registered') || text.includes('already been registered') || text.includes('user already exists')) return 'authExists';
  if (text.includes('email not confirmed')) return 'authUnconfirmed';
  if (text.includes('at least 6 characters') || text.includes('password should be') || text.includes('password too short')) return 'authWeakPassword';
  if (text.includes('rate limit') || text.includes('too many')) return 'authRateLimited';
  if (text.includes('invalid format') || text.includes('invalid email')) return 'emailInvalid';
  if (text.includes('not_authenticated')) return 'notAuthenticated';
  if (text.includes('invalid token') || text.includes('token has expired')) return 'resetInvalid';
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
  const attached = useRef<string | null>(null);

  const language = store.getLanguage();
  const theme = store.getTheme();

  useEffect(() => {
    const client = neon;
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
    if (!neon) return;
    const userId = session?.user.id ?? null;
    if (userId === attached.current) return;
    attached.current = userId;
    if (userId) void store.attach(userId);
    else store.detach();
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
      canManage: (keshtId: string) => store.canManage(keshtId),
      clearLastError: () => store.clearLastError(),
      dismissLocalImport: () => store.dismissLocalImport(),
      importLocalData: () => store.importLocalData(),
      refresh: () => store.refresh(),
      signIn: async (email: string, password: string) => {
        const client = neon;
        if (!client) return;
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message);
      },
      signUp: async (email: string, password: string) => {
        const client = neon;
        if (!client) return { needsConfirmation: false };
        const displayName = email.split('@')[0] ?? email.trim();
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          // Better Auth needs a name and uses emailRedirectTo as the confirmation
          // link callback. The display name is never shown anywhere important.
          options: {
            emailRedirectTo: globalThis.location?.origin ?? undefined,
            data: { displayName },
          },
        });
        if (error) throw new Error(error.message);
        // No session straight after signing up means confirmation is required.
        return { needsConfirmation: data.session === null };
      },
      signOut: async () => {
        const client = neon;
        if (!client) return;
        const { error } = await client.auth.signOut();
        if (error) throw new Error(error.message);
      },
      sendPasswordReset: async (email: string) => {
        const client = neon;
        if (!client) return;
        const origin = globalThis.location?.origin ?? '';
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${origin}/reset-password`,
        });
        if (error) throw new Error(error.message);
      },
      resetPassword: async (token: string, password: string) => {
        const client = neon;
        if (!client) return;
        const betterAuth = client.auth.getBetterAuthInstance();
        const { error } = await betterAuth.resetPassword({ newPassword: password, token });
        if (error) throw new Error(error.message ?? String(error));
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
  }, [helpers, actions, theme, revision, session, authReady]);

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
