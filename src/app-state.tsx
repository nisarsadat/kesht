import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRepository, type KeshtStore } from './db/repository';
import { ruleMessage, translate, type MessageKey } from './i18n/messages';
import type { Language, RuleCode } from './domain/types';
import { paletteFor, type Palette, type ThemeName } from './theme';

type AppState = {
  ready: boolean;
  language: Language;
  direction: 'rtl' | 'ltr';
  theme: ThemeName;
  colors: Palette;
  repo: KeshtStore | null;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  errorText: (code: RuleCode) => string;
  setLanguage: (language: Language) => Promise<void>;
  setTheme: (theme: ThemeName) => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [language, setLanguageState] = useState<Language>('fa');
  const [theme, setThemeState] = useState<ThemeName>('dark');
  const [repo, setRepo] = useState<KeshtStore | null>(null);

  useEffect(() => {
    let active = true;
    createRepository()
      .then(async (repository) => {
        const stored = await repository.getLanguage();
        const storedTheme = await repository.getTheme();
        if (!active) return;
        setRepo(repository);
        setLanguageState(stored);
        setThemeState(storedTheme);
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AppState>(() => {
    return {
      ready,
      language,
      direction: language === 'fa' ? 'rtl' : 'ltr',
      theme,
      colors: paletteFor(theme),
      repo,
      t: (key, vars) => translate(language, key, vars),
      errorText: (code) => ruleMessage(language, code),
      setLanguage: async (next) => {
        setLanguageState(next);
        await repo?.setLanguage(next);
      },
      setTheme: async (next) => {
        setThemeState(next);
        await repo?.setTheme(next);
      },
    };
  }, [language, theme, ready, repo]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppStateProvider missing');
  return value;
}
