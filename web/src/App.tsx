import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HistoryPage } from './pages/history';
import { HomePage } from './pages/home';
import { InvitePage } from './pages/invite';
import { KeshtLayout } from './pages/kesht-layout';
import { MemberFormPage } from './pages/member-form';
import { MembersPage } from './pages/members';
import { MonthPage } from './pages/month';
import { NewKeshtPage } from './pages/new-kesht';
import { OverviewPage } from './pages/overview';
import { ResetPasswordPage } from './pages/reset-password';
import { SharePage } from './pages/share';
import { SignInPage } from './pages/signin';
import { SpinPage } from './pages/spin';
import { ToastHost } from './components/toasts';
import type { Palette, ThemeName } from './lib/theme';
import { AppStateProvider, useApp, useRefreshOnFocus } from './state/app-state';

/** Brand accent used by the centre tab and the prize wheel. */
const ACCENT = '#6D5EF6';

function themeVars(colors: Palette, theme: ThemeName): CSSProperties {
  const vars: Record<string, string> = {
    '--bg': colors.bg,
    '--card': colors.card,
    '--ink': colors.ink,
    '--muted': colors.muted,
    '--line': colors.line,
    '--green': colors.green,
    '--green-soft': colors.greenSoft,
    '--on-green': colors.onGreen,
    '--gold': colors.gold,
    '--gold-soft': colors.goldSoft,
    '--danger': colors.danger,
    '--danger-soft': colors.dangerSoft,
    '--white': colors.white,
    '--shadow': colors.shadow,
    '--shadow-strong': theme === 'dark' ? 'rgba(0, 0, 0, 0.72)' : 'rgba(34, 27, 70, 0.22)',
    '--accent': ACCENT,
    '--tabbar': theme === 'dark' ? '#1A1A22' : '#FFFFFF',
    '--tab-muted': theme === 'dark' ? '#A1A1AA' : '#8A847C',
    '--spin-soft': theme === 'dark' ? '#2A2840' : '#F3F0FF',
  };
  return vars as CSSProperties;
}

function Waiting({ label }: { label: string }) {
  return <div className="waiting">{label}</div>;
}

/**
 * Everything except the sign-in and reset pages needs an account. The
 * local-only development build has no accounts, so it passes straight through.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { mode, session, authReady, loadingData, t } = useApp();
  const location = useLocation();

  if (mode === 'local') return <>{children}</>;
  if (!authReady) return <Waiting label={t('loading')} />;
  if (!session) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  if (loadingData) return <Waiting label={t('loading')} />;
  return <>{children}</>;
}

function Shell() {
  const { colors, direction, language, theme, configured, lastError, clearLastError, t } = useApp();
  useRefreshOnFocus();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.documentElement.style.colorScheme = theme;
    // Keeps the overscroll/rubber-band area in step with the theme.
    document.body.style.background = colors.bg;
  }, [language, direction, theme, colors.bg]);

  // A production build without credentials must say so rather than quietly
  // keeping everyone's data in one browser.
  if (!configured && !import.meta.env.DEV) {
    return (
      <div className="app-shell" style={themeVars(colors, theme)} dir="ltr">
        <div className="waiting">
          <span className="title-lg">{t('notConfiguredTitle')}</span>
          <span className="muted">{t('notConfiguredBody')}</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-shell" style={themeVars(colors, theme)} dir={direction}>
        {lastError ? (
          <div className="banner" role="alert">
            <span>{lastError}</span>
            <button type="button" className="banner-close" aria-label={t('close')} onClick={clearLastError}>
              ×
            </button>
          </div>
        ) : null}

        {/* Feedback for completed actions, above every page. */}
        <ToastHost />

        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/new"
            element={
              <RequireAuth>
                <NewKeshtPage />
              </RequireAuth>
            }
          />
          <Route
            path="/invite/:token"
            element={
              <RequireAuth>
                <InvitePage />
              </RequireAuth>
            }
          />

          <Route
            path="/k/:id"
            element={
              <RequireAuth>
                <KeshtLayout />
              </RequireAuth>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="month" element={<MonthPage />} />
            <Route path="spin" element={<SpinPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>

          {/* Sharing and the member form are full screens, outside the tab layout. */}
          <Route
            path="/k/:id/share"
            element={
              <RequireAuth>
                <SharePage />
              </RequireAuth>
            }
          />
          <Route
            path="/k/:id/member/:memberId"
            element={
              <RequireAuth>
                <MemberFormPage />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
