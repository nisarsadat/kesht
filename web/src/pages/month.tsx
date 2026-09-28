import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/confirm-dialog';
import { notify } from '../components/toasts';
import { Button, Card, Screen } from '../components/ui';
import { store } from '../data/store';
import { collectedAmount, eligibleRecipients, receivedMemberIds } from '../domain/rules';
import { formatMoney, formatMonth } from '../lib/format';
import type { MessageKey } from '../i18n/messages';
import { useApp, useBundle } from '../state/app-state';

export function MonthPage() {
  const { id } = useParams<{ id: string }>();
  const bundle = useBundle(id);
  const { t, language, errorFrom, canEdit } = useApp();
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  if (!bundle) return null;
  const keshtId = bundle.kesht.id;
  const editable = canEdit(keshtId);

  /** Runs a store change and reports either the failure or what happened. */
  function run(action: () => void, fallback: 'round_not_open', done?: MessageKey): void {
    setError('');
    try {
      action();
      if (done) notify(t(done));
    } catch (caught) {
      setError(errorFrom(caught, fallback));
    }
  }

  const round = bundle.rounds.find((item) => item.status === 'open') ?? null;
  if (!round) {
    return (
      <Screen title={t('tabMonth')} inTabs backTo={`/k/${keshtId}`}>
        <span className="muted">{bundle.kesht.status === 'completed' ? t('completedBody') : t('noOpenMonth')}</span>
      </Screen>
    );
  }

  const payments = bundle.payments.filter((payment) => payment.roundId === round.id);
  const received = receivedMemberIds(bundle);
  const eligible = eligibleRecipients(bundle);
  const recipient = bundle.members.find((member) => member.id === round.recipientMemberId);
  const unpaid = payments.some((payment) => !payment.paid);
  const nextId = eligible[0]?.id;

  return (
    <Screen
      title={t('tabMonth')}
      inTabs
      backTo={`/k/${keshtId}`}
      footer={
        editable ? (
          <>
            <Button
              label={t('collectMoney')}
              onClick={() => run(() => store.setAllPaid(keshtId, true), 'round_not_open', 'notifyAllPaid')}
            />
            <Button
              label={t('payOut')}
              onClick={() => {
                if (round.recipientMemberId) setConfirming(true);
              }}
              disabled={!round.recipientMemberId}
            />
          </>
        ) : undefined
      }
    >
      {editable ? null : <span className="muted">{t('readOnly')}</span>}

      <Card>
        <span className="strong">{formatMonth(round.year, round.month, language)}</span>
        <span className="muted">
          {t('expectedPot')}: {formatMoney(bundle.members.length * bundle.kesht.monthlyAmount, language)}
        </span>
        <span className="amount">
          {t('collected')}: {formatMoney(collectedAmount(bundle, round.id), language)}
        </span>
        <span>
          {t('receives')}: {recipient?.name ?? t('none')}
        </span>
      </Card>

      {editable ? (
        <div className="row">
          <Button
            label={t('markAllPaid')}
            tone="ghost"
            small
            onClick={() => run(() => store.setAllPaid(keshtId, true), 'round_not_open', 'notifyAllPaid')}
          />
          <Button label={t('clearPaid')} tone="ghost" small onClick={() => setConfirmingClear(true)} />
        </div>
      ) : null}

      {payments.map((payment) => {
        const member = bundle.members.find((item) => item.id === payment.memberId);
        const already = member ? received.has(member.id) : false;
        return (
          <Card
            key={payment.id}
            onClick={
              editable
                ? () =>
                    run(
                      () => store.setPaid(keshtId, payment.id, !payment.paid),
                      'round_not_open',
                      payment.paid ? 'notifyMarkedUnpaid' : 'notifyMarkedPaid',
                    )
                : undefined
            }
          >
            <div className="spread">
              <span className="strong">{member?.name}</span>
              <span className={payment.paid ? 'amount' : 'muted'}>{payment.paid ? t('paid') : t('notPaid')}</span>
            </div>
            {already ? (
              <span className="gold">
                {t('alreadyReceived')} — {t('stillPays')}
              </span>
            ) : null}
          </Card>
        );
      })}

      <span className="strong">{t('chooseRecipient')}</span>
      <span className="rule-note">{t('noDoubleWin')}</span>
      {eligible.map((member) => (
        <Card
          key={member.id}
          onClick={
            editable
              ? () => run(() => store.setRecipient(keshtId, member.id), 'round_not_open', 'notifyRecipientSet')
              : undefined
          }
        >
          <span className={member.id === round.recipientMemberId ? 'amount' : 'strong'}>
            {member.id === round.recipientMemberId ? '● ' : '○ '}
            {member.name}
            {member.id === nextId ? ` · ${t('suggested')}` : ''}
          </span>
        </Card>
      ))}

      {editable && confirming ? (
        <ConfirmDialog
          title={unpaid ? t('unpaidTitle') : t('closeTitle')}
          body={unpaid ? t('unpaidBody') : t('closeBody')}
          confirmLabel={t('closeMonth')}
          cancelLabel={t('back')}
          onConfirm={() =>
            run(
              () => {
                store.closeRound(keshtId);
                setConfirming(false);
              },
              'round_not_open',
              'notifyMonthClosed',
            )
          }
          onCancel={() => setConfirming(false)}
        />
      ) : null}

      {editable && confirmingClear ? (
        <ConfirmDialog
          title={t('clearPaidTitle')}
          body={t('clearPaidBody')}
          confirmLabel={t('clearPaid')}
          cancelLabel={t('back')}
          onConfirm={() => {
            setConfirmingClear(false);
            run(() => store.setAllPaid(keshtId, false), 'round_not_open', 'notifyPaymentsCleared');
          }}
          onCancel={() => setConfirmingClear(false)}
        />
      ) : null}

      {error ? <span className="danger-text">{error}</span> : null}
    </Screen>
  );
}
