import { useParams } from 'react-router-dom';
import { Card, Screen } from '../components/ui';
import { collectedAmount } from '../domain/rules';
import { formatMoney, formatMonth, localizeNumber } from '../lib/format';
import { useApp, useBundle } from '../state/app-state';

export function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const bundle = useBundle(id);
  const { t, language } = useApp();

  if (!bundle) return null;

  const closed = bundle.rounds
    .filter((round) => round.status === 'closed')
    .sort((a, b) => b.sequence - a.sequence);

  return (
    <Screen title={t('tabHistory')} inTabs backTo={`/k/${bundle.kesht.id}`}>
      {closed.length === 0 ? <span className="muted">{t('noHistory')}</span> : null}
      {closed.map((round) => {
        const recipient = bundle.members.find((member) => member.id === round.recipientMemberId);
        return (
          <Card key={round.id}>
            <span className="strong">
              {localizeNumber(round.sequence, language)}. {formatMonth(round.year, round.month, language)}
            </span>
            <span>
              {t('receivedBy')}: {recipient?.name ?? t('none')}
            </span>
            <span className="amount">
              {t('payout')}: {formatMoney(collectedAmount(bundle, round.id), language)}
            </span>
          </Card>
        );
      })}
    </Screen>
  );
}
