import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/confirm-dialog';
import { notify } from '../components/toasts';
import { Button, Screen } from '../components/ui';
import { store } from '../data/store';
import { collectedAmount, receivedMemberIds } from '../domain/rules';
import { formatMoney, formatMonth, localizeNumber } from '../lib/format';
import type { MessageKey } from '../i18n/messages';
import { useApp, useBundle } from '../state/app-state';

function initial(name: string): string {
  return name.trim().charAt(0) || '؟';
}

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
        <span className="muted">
          {bundle.kesht.status === 'completed' ? t('completedBody') : t('noOpenMonth')}
        </span>
      </Screen>
    );
  }

  const payments = bundle.payments.filter((payment) => payment.roundId === round.id);
  const received = receivedMemberIds(bundle);
  const recipient = bundle.members.find((member) => member.id === round.recipientMemberId);
  const unpaid = payments.some((payment) => !payment.paid);
  const paidCount = payments.filter((payment) => payment.paid).length;
  const collected = collectedAmount(bundle, round.id);
  const expected = bundle.members.length * bundle.kesht.monthlyAmount;

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
              onClick={() =>
                run(() => store.setAllPaid(keshtId, true), 'round_not_open', 'notifyAllPaid')
              }
            />
            <Button
              label={t('payOut')}
              tone="ghost"
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

      <section className="month-summary" aria-label={t('tabMonth')}>
        <span className="month-summary-date">
          {formatMonth(round.year, round.month, language)}
        </span>
        <div className="month-summary-grid">
          <div className="month-summary-stat">
            <span className="month-summary-value">{formatMoney(collected, language)}</span>
            <span className="month-summary-label">{t('collected')}</span>
          </div>
          <div className="month-summary-stat">
            <span className="month-summary-value">{formatMoney(expected, language)}</span>
            <span className="month-summary-label">{t('expectedPot')}</span>
          </div>
          <div className="month-summary-stat">
            <span className="month-summary-value">
              {localizeNumber(paidCount, language)}/{localizeNumber(payments.length, language)}
            </span>
            <span className="month-summary-label">{t('paid')}</span>
          </div>
        </div>
        <div className="month-recipient-line">
          <span className="muted">{t('receives')}</span>
          <span className="strong">{recipient?.name ?? t('none')}</span>
        </div>
        {!recipient ? <span className="muted">{t('pickWinnerOnSpin')}</span> : null}
      </section>

      <div className="month-list-head">
        <span className="strong">{t('monthPayList')}</span>
        {editable ? (
          <button
            type="button"
            className="text-action"
            onClick={() => setConfirmingClear(true)}
          >
            {t('clearPaid')}
          </button>
        ) : null}
      </div>
      <span className="muted month-list-hint">{t('monthCollectHint')}</span>

      <ul className="pay-list">
        {payments.map((payment) => {
          const member = bundle.members.find((item) => item.id === payment.memberId);
          const name = member?.name ?? t('none');
          const already = member ? received.has(member.id) : false;
          return (
            <li key={payment.id}>
              <button
                type="button"
                className={`pay-row${payment.paid ? ' paid' : ''}${editable ? '' : ' readonly'}`}
                disabled={!editable}
                aria-pressed={payment.paid}
                onClick={() =>
                  run(
                    () => store.setPaid(keshtId, payment.id, !payment.paid),
                    'round_not_open',
                    payment.paid ? 'notifyMarkedUnpaid' : 'notifyMarkedPaid',
                  )
                }
              >
                <span className="pay-avatar" aria-hidden="true">
                  {initial(name)}
                </span>
                <span className="pay-main">
                  <span className="pay-name">{name}</span>
                  <span className="pay-meta">
                    {formatMoney(payment.amount, language)}
                    {already ? ` · ${t('alreadyReceived')}` : ''}
                  </span>
                </span>
                <span className={`pay-status${payment.paid ? ' is-paid' : ''}`}>
                  {payment.paid ? t('paid') : t('notPaid')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

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
            run(
              () => store.setAllPaid(keshtId, false),
              'round_not_open',
              'notifyPaymentsCleared',
            );
          }}
          onCancel={() => setConfirmingClear(false)}
        />
      ) : null}

      {error ? <span className="danger-text">{error}</span> : null}
    </Screen>
  );
}
