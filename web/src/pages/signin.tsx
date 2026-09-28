import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { notify } from '../components/toasts';
import { Button, Card, Field, Screen } from '../components/ui';
import { useApp } from '../state/app-state';

type FormMode = 'signIn' | 'signUp';

export function SignInPage() {
  const { t, session, mode, signIn, signUp, authErrorFrom } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [formMode, setFormMode] = useState<FormMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const requested = (location.state as { from?: string } | null)?.from;
  const from = requested && !requested.startsWith('/signin') ? requested : '/';

  // The local-only development build has no accounts at all.
  if (mode === 'local') return <Navigate to="/" replace />;
  if (session && !sent) return <Navigate to={from} replace />;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError(t('emailInvalid'));
      return;
    }
    if (formMode === 'signUp') {
      if (password.length < 6) {
        setError(t('authWeakPassword'));
        return;
      }
      if (password !== confirm) {
        setError(t('passwordMismatch'));
        return;
      }
    }
    setBusy(true);
    try {
      if (formMode === 'signIn') {
        await signIn(email, password);
        notify(t('notifySignedIn'));
        navigate(from, { replace: true });
      } else {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) setSent(true);
        else {
          notify(t('notifySignedIn'));
          navigate(from, { replace: true });
        }
      }
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen title={t('checkEmailTitle')}>
        <Card>
          <span className="strong">{t('checkEmailTitle')}</span>
          <span className="muted">{t('checkEmailBody')}</span>
          <Button label={t('backToSignIn')} tone="ghost" onClick={() => setSent(false)} />
        </Card>
      </Screen>
    );
  }

  const creating = formMode === 'signUp';

  return (
    <Screen
      title={creating ? t('signUp') : t('signIn')}
      form={{ id: 'auth-form', onSubmit: submit }}
      footer={<Button type="submit" label={creating ? t('signUp') : t('signIn')} disabled={busy} />}
    >
      <Card>
        <span className="strong">{t('appName')}</span>
        <span className="muted">{creating ? t('signUpBody') : t('signInBody')}</span>
      </Card>

      <Field label={t('email')} value={email} onChange={setEmail} type="email" inputMode="text" autoFocus required />
      <Field label={t('password')} value={password} onChange={setPassword} type="password" required />
      {creating ? <Field label={t('confirmPassword')} value={confirm} onChange={setConfirm} type="password" required /> : null}

      {error ? <span className="danger-text">{error}</span> : null}

      <button type="button" className="link-button" onClick={() => {
        setError('');
        setFormMode(creating ? 'signIn' : 'signUp');
      }}>
        {creating ? t('haveAccount') : t('needAccount')}
      </button>

      <Link className="link-button" to="/reset-password">
        {t('forgotPassword')}
      </Link>
    </Screen>
  );
}
