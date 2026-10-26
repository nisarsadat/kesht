
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { isCloudConfigured, neon } from '../data/neon';
import { store, type Mode, type Role } from '../data/store';
import type {
  Bundle,
  KeshtSummary,
  Language,
  RuleCode,
} from '../domain/types';
import { KeshtRuleError } from '../domain/types';
import {
  ruleMessage,
  translate,
  type MessageKey,
} from '../i18n/messages';
import { paletteFor, type Palette, type ThemeName } from '../lib/theme';

type Session = { user: { id: string; email?: string | null } } | null;

type AppState = {
  mode: Mode;
  configured: boolean;
  session: Session | null;
  authReady: boolean;
  email: string | null;
  loadingData: boolean;
  language: Language;
  direction: 'rtl' | 'ltr';
  theme: ThemeName;
  colors: Palette;
  revision: number;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  errorFrom: (caught: unknown, fallback: MessageKey) => string;
  authErrorFrom: (caught: unknown) => string;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeName) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  roleOf: (keshtId: string) => Role | null;
  canEdit: (keshtId: string) => boolean;
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

function authMessageKey(message: string): MessageKey | null {
  const text = message.toLowerCase();

  if (
    text.includes('invalid login credentials') ||
    text.includes('invalid email or password')
  ) {
    return 'authInvalid';
  }

  if (
    text.includes('already registered') ||
    text.includes('already been registered') ||
    text.includes('user already exists')
  ) {
    return 'authExists';
  }

  if (text.includes('email not confirmed')) {
    return 'authUnconfirmed';
  }

  if (
    text.includes('at least 6 characters') ||
    text.includes('password should be') ||
    text.includes('password too short')
  ) {
    return 'authWeakPassword';
  }

  if (text.includes('rate limit') || text.includes('too many')) {
    return 'authRateLimited';
  }

  if (
    text.includes('invalid format') ||
    text.includes('invalid email')
  ) {
    return 'emailInvalid';
  }

  if (text.includes('not_authenticated')) {
    return 'notAuthenticated';
  }

  if (
    text.includes('invalid token') ||
    text.includes('token has expired')
  ) {
    return 'resetInvalid';
  }

  if (
    text.includes('failed to fetch') ||
    text.includes('load failed') ||
    text.includes('network')
  ) {
    return 'networkError';
  }

  if (
    text.includes('authentication required') ||
    text.includes('valid token') ||
    text.includes('not a valid jwt')
  ) {
    return 'notAuthenticated';
  }

  return null;
}

function messageOf(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  if (typeof caught === 'string') return caught;
  return '';
}

function isSessionNotFoundMessage(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes('failed to retrieve user session') ||
    text.includes('session not found')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toAppSession(session: {
  user?: { id?: string; email?: string | null } | null;
} | null): Session {
  const id = session?.user?.id;
  if (!id) return null;
  return {
    user: {
      id,
      email: session?.user?.email ?? null,
    },
  };
}

/** WebKit may not expose Set-Cookie to the next fetch immediately. */
async function waitForSession(
  client: NonNullable<typeof neon>,
): Promise<Session | null> {
  const delaysMs = [100, 200, 250];

  for (const delayMs of delaysMs) {
    await sleep(delayMs);

    try {
      // forceFetch avoids cookie-cache responses that omit set-auth-jwt.
      const { data, error } = await client.auth.getSession({
        forceFetch: true,
      });
      if (error) continue;
      const next = toAppSession(data.session);
      if (next) return next;
    } catch {
      // Keep retrying until delays are exhausted.
    }
  }

  return null;
}

export function AppStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const revision = useSyncExternalStore(
    store.subscribe,
    store.getRevision,
    store.getRevision,
  );

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const attached = useRef<string | null>(null);
  // Same-tab SIGNED_IN broadcasts are ignored by the SDK; apply session ourselves.
  const applySession = useRef((next: Session | null) => {
    setSession(next);
  });
  applySession.current = (next) => {
    setSession(next);
    setAuthReady(true);
  };

  const language = store.getLanguage();
  const theme = store.getTheme();

  useEffect(() => {
    const client = neon;

    if (!client) {
      setAuthReady(true);
      return;
    }

    // Keep a narrowed, non-null client for the async function.
    const authClient = client;
    let active = true;

    async function initializeSession() {
      try {
        const { data, error } = await authClient.auth.getSession({
          forceFetch: true,
        });

        if (error) throw error;
        if (!active) return;

        setSession(toAppSession(data.session));
      } catch (caught) {
        console.error(
          '[Auth] Initial session retrieval failed:',
          caught,
        );

        if (!active) return;
        setSession(null);
      } finally {
        if (active) setAuthReady(true);
      }
    }

    void initializeSession();

    const { data } = authClient.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;

        setSession(toAppSession(nextSession));
        setAuthReady(true);
      },
    );

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

    if (userId) {
      void store.attach(userId);
    } else {
      store.detach();
    }
  }, [session]);

  const helpers = useMemo(() => {
    const t = (
      key: MessageKey,
      vars?: Record<string, string | number>,
    ) => translate(language, key, vars);

    const authErrorFrom = (caught: unknown): string => {
      const raw = messageOf(caught);
      const key = raw ? authMessageKey(raw) : null;

      return key
        ? translate(language, key)
        : raw || translate(language, 'networkError');
    };

    const errorFrom = (
      caught: unknown,
      fallback: MessageKey,
    ): string =>
      caught instanceof KeshtRuleError
        ? ruleMessage(language, caught.code)
        : translate(language, fallback);

    return { t, authErrorFrom, errorFrom };
  }, [language]);

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

        if (!client) {
          throw new Error('Neon is not configured');
        }

        console.info('[Auth] Starting sign-in');

        let result;

        try {
          result = await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
        } catch (caught) {
          console.error(
            '[Auth] Sign-in request failed:',
            caught,
          );
          throw caught;
        }

        console.info('[Auth] Sign-in response:', {
          hasError: Boolean(result.error),
          hasSession: Boolean(result.data?.session),
          errorMessage: result.error?.message ?? null,
        });

        if (result.error) {
          if (isSessionNotFoundMessage(result.error.message)) {
            console.warn(
              '[Auth] Session missing after sign-in; retrying getSession',
            );
            const recovered = await waitForSession(client);
            if (recovered) {
              applySession.current(recovered);
              return;
            }
          }

          console.error('[Auth] Sign-in error:', result.error);
          throw new Error(result.error.message);
        }

        const fromResult = toAppSession(result.data?.session ?? null);
        if (fromResult) {
          applySession.current(fromResult);
          // Refresh JWT for Data API (cookie cache can omit set-auth-jwt).
          void client.auth.getSession({ forceFetch: true });
          return;
        }

        const recovered = await waitForSession(client);
        if (recovered) {
          applySession.current(recovered);
          return;
        }

        throw new Error(
          'Sign-in returned successfully, but no session was returned.',
        );
      },

      signUp: async (email: string, password: string) => {
        const client = neon;

        if (!client) {
          return { needsConfirmation: false };
        }

        const displayName = email.split('@')[0] ?? email.trim();

        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: globalThis.location?.origin ?? undefined,
            data: { displayName },
          },
        });

        if (error) {
          if (isSessionNotFoundMessage(error.message)) {
            console.warn(
              '[Auth] Session missing after sign-up; retrying getSession',
            );
            const recovered = await waitForSession(client);
            if (recovered) {
              applySession.current(recovered);
              return { needsConfirmation: false };
            }
          }

          throw new Error(error.message);
        }

        const fromResult = toAppSession(data.session);
        if (fromResult) {
          applySession.current(fromResult);
          void client.auth.getSession({ forceFetch: true });
          return { needsConfirmation: false };
        }

        const recovered = await waitForSession(client);
        if (recovered) {
          applySession.current(recovered);
          return { needsConfirmation: false };
        }

        return { needsConfirmation: true };
      },

      signOut: async () => {
        const client = neon;

        if (!client) {
          applySession.current(null);
          return;
        }

        try {
          const { error } = await client.auth.signOut();
          if (error) throw new Error(error.message);
        } finally {
          // Same-tab auth events are ignored by the SDK; clear UI session here.
          applySession.current(null);
        }
      },

      sendPasswordReset: async (email: string) => {
        const client = neon;

        if (!client) return;

        const origin = globalThis.location?.origin ?? '';

        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${origin}/reset-password` },
        );

        if (error) throw new Error(error.message);
      },

      resetPassword: async (token: string, password: string) => {
        const client = neon;

        if (!client) return;

        const betterAuth = client.auth.getBetterAuthInstance();

        const { error } = await betterAuth.resetPassword({
          newPassword: password,
          token,
        });

        if (error) {
          throw new Error(error.message ?? String(error));
        }
      },
    }),
    [],
  );

  const value = useMemo<AppState>(
    () => ({
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
    }),
    [
      helpers,
      actions,
      theme,
      revision,
      session,
      authReady,
      language,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const value = useContext(AppContext);

  if (!value) {
    throw new Error('AppStateProvider missing');
  }

  return value;
}

export function useBundle(
  keshtId: string | undefined,
): Bundle | null {
  const { revision } = useApp();

  return useMemo(
    () => (keshtId ? store.getBundle(keshtId) : null),
    [keshtId, revision],
  );
}

export function useSummaries(): KeshtSummary[] {
  const { revision } = useApp();

  return useMemo(
    () => store.listKeshts(),
    [revision],
  );
}

export function useRefreshOnFocus(): void {
  const refresh = useCallback(() => {
    void store.refresh();
  }, []);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
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
