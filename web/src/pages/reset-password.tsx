import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Field, Screen } from '../components/ui';
import { useApp } from '../state/app-state';

export function ResetPasswordPage() {
  const { t, sendPasswordReset, resetPassword, authErrorFrom } = useApp();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // The emailed link lands here with ?token=...
  const token = searchParams.get('token');
  const choosingPassword = token !== null && token !== '';

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError('');
    if (!choosingPassword) {
      if (!email.includes('@')) {
        setError(t('emailInvalid'));
        return;
      }
    } else {
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
      if (choosingPassword) {
        await resetPassword(token, password);
        setDone(true);
      } else {
        await sendPasswordReset(email);
        setSent(true);
      }
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen title={t('resetPassword')} backTo="/signin">
        <Card>
          <span className="strong">{t('passwordUpdated')}</span>
          <Button to="/signin" label={t('backToSignIn')} />
        </Card>
      </Screen>
    );
  }

  if (sent) {
    return (
      <Screen title={t('checkEmailTitle')} backTo="/signin">
        <Card>
          <span className="strong">{t('checkEmailTitle')}</span>
          <span className="muted">{t('resetBody')}</span>
          <Button to="/signin" label={t('backToSignIn')} tone="ghost" />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={choosingPassword ? t('newPassword') : t('resetPassword')}
      backTo="/signin"
      form={{ id: 'reset-form', onSubmit: submit }}
      footer={
        <Button
          type="submit"
          label={choosingPassword ? t('updatePassword') : t('sendResetLink')}
          disabled={busy}
        />
      }
    >
      {choosingPassword ? (
        <>
          <Field label={t('newPassword')} value={password} onChange={setPassword} type="password" autoFocus required />
          <Field label={t('confirmPassword')} value={confirm} onChange={setConfirm} type="password" required />
        </>
      ) : (
        <>
          <Card>
            <span className="muted">{t('resetBody')}</span>
          </Card>
          <Field label={t('email')} value={email} onChange={setEmail} type="email" autoFocus required />
        </>
      )}

      {error ? <span className="danger-text">{error}</span> : null}

      <Link className="link-button" to="/signin">
        {t('backToSignIn')}
      </Link>
    </Screen>
  );
}
