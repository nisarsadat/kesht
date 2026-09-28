import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { notify } from '../components/toasts';
import { Badge, Button, Card, Screen } from '../components/ui';
import { store } from '../data/store';
import { expectedPot, nextInOrder, receivedMemberIds } from '../domain/rules';
import { formatMoney, formatMonth, localizeNumber } from '../lib/format';
import { useApp, useBundle } from '../state/app-state';

export function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const bundle = useBundle(id);
  const { t, language, errorFrom, canEdit } = useApp();
  const [error, setError] = useState('');

  if (!bundle) return null;

  const editable = canEdit(bundle.kesht.id);
  const received = receivedMemberIds(bundle);
  const next = nextInOrder(bundle);
  const open = bundle.rounds.find((round) => round.status === 'open') ?? null;
  const receivedMembers = bundle.members
    .filter((member) => received.has(member.id))
    .sort((a, b) => a.turnOrder - b.turnOrder);

  function start(): void {
    if (!bundle) return;
    setError('');
    try {
      store.startKesht(bundle.kesht.id);
      notify(t('notifyKeshtStarted'));
    } catch (caught) {
      setError(errorFrom(caught, 'need_two_members'));
    }
  }

  return (
    <Screen title={bundle.kesht.name} inTabs backTo="/">
      {editable ? null : <span className="muted">{t('readOnly')}</span>}

      <Card>
        <Badge
          label={t(bundle.kesht.status)}
          tone={bundle.kesht.status === 'active' ? 'green' : bundle.kesht.status === 'completed' ? 'stone' : 'gold'}
        />
        <span>{t('personCount', { count: localizeNumber(bundle.members.length, language) })}</span>
        <span className="muted">
          {formatMoney(bundle.kesht.monthlyAmount, language)} · {t('period')}:{' '}
          {t('months', { count: localizeNumber(bundle.members.length, language) })}
        </span>
        {open ? (
          <span className="strong">
            {t('monthProgress', {
              current: localizeNumber(open.sequence, language),
              total: localizeNumber(bundle.members.length, language),
            })}{' '}
            · {formatMonth(open.year, open.month, language)}
          </span>
        ) : null}
        <span className="muted">
          {t('expectedPot')}: {formatMoney(expectedPot(bundle), language)}
        </span>
        {bundle.kesht.status !== 'completed' && next ? (
          <span className="amount">
            {t('nextRecipient')}: {next.name}
          </span>
        ) : null}
        {bundle.kesht.status === 'completed' ? <span>{t('completedBody')}</span> : null}
      </Card>

      <Card>
        <span className="strong">{t('whoReceived')}</span>
        {receivedMembers.length === 0 ? (
          <span className="muted">{t('notYet')}</span>
        ) : (
          receivedMembers.map((member) => (
            <span key={member.id}>
              {localizeNumber(member.turnOrder, language)}. {member.name}
            </span>
          ))
        )}
      </Card>

      {error ? <span className="danger-text">{error}</span> : null}
      {editable && bundle.kesht.status === 'draft' ? (
        <Button label={t('start')} onClick={start} disabled={bundle.members.length < 2} />
      ) : null}
      {editable && bundle.kesht.status === 'draft' && bundle.members.length < 2 ? (
        <span className="muted">{t('needTwoHint')}</span>
      ) : null}
      {editable ? <Button to={`/k/${bundle.kesht.id}/share`} label={t('share')} tone="ghost" /> : null}
    </Screen>
  );
}
