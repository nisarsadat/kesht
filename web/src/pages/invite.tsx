import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notify } from '../components/toasts';
import { Button, Card, Screen } from '../components/ui';
import { redeemInvite } from '../data/sharing';
import { useApp } from '../state/app-state';

/**
 * Landing page for a share link. The route is behind the sign-in guard, so by
 * the time this runs there is always an account to add to the kesht.
 */
export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { t, refresh, authErrorFrom } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    void (async () => {
      try {
        const keshtId = await redeemInvite(token);
        await refresh();
        if (!active) return;
        if (keshtId) {
          notify(t('inviteJoined'));
          navigate(`/k/${keshtId}`, { replace: true });
        }
      } catch (caught) {
        if (active) setError(authErrorFrom(caught));
      }
    })();
    return () => {
      active = false;
    };
    // Runs once per token; re-running on every store change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Screen title={t('shareLink')}>
      <Card>
        {error ? (
          <>
            <span className="strong">{t('inviteInvalid')}</span>
            <span className="muted">{error}</span>
            <Button to="/" label={t('goHome')} />
          </>
        ) : (
          <span className="muted">{t('joiningInvite')}</span>
        )}
      </Card>
    </Screen>
  );
}
