import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/confirm-dialog';
import { notify } from '../components/toasts';
import { Badge, Button, Card, Screen } from '../components/ui';
import { adminDeleteKesht, adminListKeshts, adminListUsers, type AdminKesht, type AdminUser } from '../data/admin';
import { localizeNumber } from '../lib/format';
import { useApp } from '../state/app-state';

function formatDate(value: string, language: 'fa' | 'en'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Hidden super-admin screen, only reachable at /admin and only rendered for
 * the account the database recognises as admin. The route exists so support
 * work (seeing who signed up, what exists, cleaning up a kesht) does not need
 * SQL access. The real gate is the database: every call refuses non-admins.
 */
export function AdminPage() {
  const { t, language, mode, isAdmin, authErrorFrom, errorFrom } = useApp();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [keshts, setKeshts] = useState<AdminKesht[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminKesht | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextUsers, nextKeshts] = await Promise.all([adminListUsers(), adminListKeshts()]);
      setUsers(nextUsers);
      setKeshts(nextKeshts);
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setLoading(false);
    }
  }, [authErrorFrom]);

  useEffect(() => {
    if (mode === 'local' || !isAdmin) return;
    void load();
  }, [load, mode, isAdmin]);

  async function remove(kesht: AdminKesht): Promise<void> {
    setPendingDelete(null);
    setError('');
    setBusy(true);
    try {
      await adminDeleteKesht(kesht.keshtId);
      await load();
      notify(t('notifyAdminKeshtDeleted'));
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'local') {
    return (
      <Screen title={t('adminTitle')} backTo="/">
        <Card>
          <span className="muted">{t('shareCloudOnly')}</span>
        </Card>
      </Screen>
    );
  }

  if (!isAdmin) {
    return (
      <Screen title={t('adminTitle')} backTo="/">
        <Card>
          <span className="muted">{t('adminForbidden')}</span>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t('adminTitle')} backTo="/">
      {error ? (
        <Card>
          <span className="strong" style={{ color: 'var(--danger)' }}>
            {errorFrom(new Error(error), 'networkError')}
          </span>
        </Card>
      ) : null}

      <Card>
        <span className="strong">{t('adminUsers')}</span>
        {loading ? <span className="muted">{t('loading')}</span> : null}
        {!loading && users.length === 0 ? <span className="muted">{t('adminEmptyUsers')}</span> : null}
        {users.map((user) => (
          <div key={user.userId} className="spread">
            <span className="person">
              <span className="strong">{user.email ?? t('none')}</span>
              <span className="muted">{formatDate(user.createdAt, language)}</span>
            </span>
          </div>
        ))}
      </Card>

      <Card>
        <span className="strong">{t('adminKeshts')}</span>
        {loading ? <span className="muted">{t('loading')}</span> : null}
        {!loading && keshts.length === 0 ? <span className="muted">{t('adminEmptyKeshts')}</span> : null}
        {keshts.map((kesht) => (
          <div key={kesht.keshtId} className="spread">
            <span className="person">
              <span className="strong">{kesht.name}</span>
              <span className="muted">
                {t('signedInAs')}: {kesht.ownerEmail ?? t('none')} ·{' '}
                {t('personCount', { count: localizeNumber(kesht.memberCount, language) })} ·{' '}
                {formatDate(kesht.createdAt, language)}
              </span>
            </span>
            <span className="badges">
              <Badge
                label={t(kesht.status as 'draft' | 'active' | 'completed')}
                tone={kesht.status === 'active' ? 'green' : kesht.status === 'completed' ? 'stone' : 'gold'}
              />
              <Button label={t('delete')} tone="danger" small disabled={busy} onClick={() => setPendingDelete(kesht)} />
            </span>
          </div>
        ))}
      </Card>

      {pendingDelete ? (
        <ConfirmDialog
          title={t('adminDeleteTitle')}
          body={t('adminDeleteBody', { name: pendingDelete.name })}
          confirmLabel={t('delete')}
          cancelLabel={t('back')}
          onConfirm={() => void remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}

      <Button label={t('adminRefresh')} tone="ghost" small disabled={busy} onClick={() => void load()} />
    </Screen>
  );
}
