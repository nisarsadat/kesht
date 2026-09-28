import { useState } from 'react';
import { Link } from 'react-router-dom';
import { notify } from '../components/toasts';
import { Badge, Button, Card, Screen } from '../components/ui';
import { formatMoney } from '../lib/format';
import { useApp, useSummaries } from '../state/app-state';

export function HomePage() {
  const {
    t,
    language,
    mode,
    email,
    isAdmin,
    signOut,
    roleOf,
    hasLocalData,
    localDataCount,
    importLocalData,
    dismissLocalImport,
  } = useApp();
  const items = useSummaries();
  const [busy, setBusy] = useState(false);

  async function bring() {
    setBusy(true);
    try {
      const count = await importLocalData();
      if (count > 0) notify(t('imported', { count }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('appName')} footer={<Button to="/new" label={t('newKesht')} />}>
      <p className="muted" style={{ margin: 0 }}>
        {t('tagline')}
      </p>

      {mode === 'local' ? (
        <Card>
          <span className="muted">{t('localMode')}</span>
        </Card>
      ) : null}

      {hasLocalData ? (
        <Card>
          <span className="strong">{t('importTitle')}</span>
          <span className="muted">{t('importBody', { count: localDataCount })}</span>
          <div className="row">
            <Button label={t('importYes')} small disabled={busy} onClick={() => void bring()} />
            <Button label={t('importNo')} tone="ghost" small onClick={dismissLocalImport} />
          </div>
        </Card>
      ) : null}


      {items.length === 0 ? (
        <Card>
          <span className="title-lg">{t('emptyTitle')}</span>
          <span className="muted">{t('emptyBody')}</span>
        </Card>
      ) : (
        items.map((item) => (
          <Link key={item.id} to={`/k/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }} className="fade-in">
            <Card style={{ cursor: 'pointer' }}>
              <div className="spread">
                <span className="title-lg">{item.name}</span>
                <span className="badges">
                  {roleOf(item.id) === 'viewer' ? <Badge label={t('sharedBadge')} tone="stone" /> : null}
                  <Badge
                    label={t(item.status)}
                    tone={item.status === 'active' ? 'green' : item.status === 'completed' ? 'stone' : 'gold'}
                  />
                </span>
              </div>
              <span className="muted">
                {formatMoney(item.monthlyAmount, language)} · {t('personCount', { count: item.memberCount })}
              </span>
            </Card>
          </Link>
        ))
      )}

      {mode === 'cloud' ? (
        <Card>
          <span className="strong">{t('account')}</span>
          <span className="muted">
            {t('signedInAs')}: {email ?? t('none')}
          </span>
          {isAdmin ? <Button to="/admin" label={t('adminTitle')} tone="ghost" small /> : null}
          <Button label={t('signOut')} tone="ghost" small onClick={() => void signOut()} />
        </Card>
      ) : null}
    </Screen>
  );
}
