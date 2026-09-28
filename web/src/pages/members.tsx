import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ActionMenu, type MenuItem } from '../components/action-menu';
import { ConfirmDialog } from '../components/confirm-dialog';
import { notify } from '../components/toasts';
import { Badge, Button, Screen } from '../components/ui';
import { store } from '../data/store';
import { receivedMemberIds } from '../domain/rules';
import { formatMoney, formatMonth, localizeNumber } from '../lib/format';
import { useApp, useBundle } from '../state/app-state';

export function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const bundle = useBundle(id);
  const { t, language, canEdit } = useApp();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (!bundle) return null;

  const keshtId = bundle.kesht.id;
  const editable = canEdit(keshtId);
  const canJoin = bundle.kesht.status === 'active' && editable;
  const locked = bundle.kesht.status !== 'draft';
  const closedRounds = bundle.rounds.filter((round) => round.status === 'closed');
  const receivedIds = receivedMemberIds(bundle);
  const ordered = [...bundle.members].sort((a, b) => a.turnOrder - b.turnOrder);
  const lastIndex = ordered.length - 1;

  function remove(memberId: string): void {
    setPendingDelete(null);
    store.removeMember(keshtId, memberId);
    notify(t('notifyMemberRemoved'));
  }

  function move(memberId: string, direction: 'up' | 'down'): void {
    store.moveMember(keshtId, memberId, direction);
    notify(t('notifyMemberMoved'));
  }

  return (
    <Screen
      title={t('tabPeople')}
      inTabs
      backTo={`/k/${keshtId}`}
      footer={editable ? <Button to={`/k/${keshtId}/member/new`} label={t('addMember')} /> : undefined}
    >
      <span className="muted">{t('equalMoney')}</span>
      {editable ? null : <span className="muted">{t('readOnly')}</span>}
      {canJoin ? <span className="muted">{t('joinHint')}</span> : locked ? null : <span className="muted">{t('lockedHint')}</span>}

      {editable && pendingDelete ? (
        <ConfirmDialog
          title={t('deleteMemberTitle')}
          body={t('deleteMemberBody')}
          confirmLabel={t('delete')}
          cancelLabel={t('back')}
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}

      {ordered.length === 0 ? (
        <span className="empty-note">{t('noMembers')}</span>
      ) : (
        <div className="table-wrap">
          <table className="table" aria-label={t('tabPeople')}>
            <thead>
              <tr>
                <th className="col-num" scope="col">
                  {t('turn')}
                </th>
                <th scope="col">{t('name')}</th>
                <th className="col-actions" scope="col">
                  <span className="sr-only">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((member, index) => {
                const catchUps = closedRounds.flatMap((round) => {
                  const due = bundle.payments.find(
                    (payment) => payment.roundId === round.id && payment.memberId === member.id && !payment.paid,
                  );
                  return due ? [{ due, round }] : [];
                });

                const received = receivedIds.has(member.id);
                const items: MenuItem[] = [];
                if (editable) {
                  for (const { due, round } of catchUps) {
                    items.push({
                      label: `${t('markCatchUpPaid')} · ${formatMonth(round.year, round.month, language)} · ${formatMoney(due.amount, language)}`,
                      onSelect: () => {
                        store.setPaid(keshtId, due.id, true);
                        notify(t('notifyMarkedPaid'));
                      },
                    });
                  }
                  if (!locked) {
                    items.push({
                      label: t('up'),
                      disabled: index === 0,
                      onSelect: () => move(member.id, 'up'),
                    });
                    items.push({
                      label: t('down'),
                      disabled: index === lastIndex,
                      onSelect: () => move(member.id, 'down'),
                    });
                  }
                  if (bundle.kesht.status !== 'completed') {
                    items.push({ label: t('editMember'), to: `/k/${keshtId}/member/${member.id}` });
                  }
                  if (bundle.kesht.status !== 'completed' && !received) {
                    items.push({ label: t('delete'), tone: 'danger', onSelect: () => setPendingDelete(member.id) });
                  }
                }

                return (
                  <tr key={member.id} style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
                    <td className="col-num">{localizeNumber(index + 1, language)}</td>
                    <td>
                      <div className="person">
                        <span className="strong">{member.name}</span>
                        {member.fatherName ? (
                          <span className="muted">
                            {t('fatherName')}: {member.fatherName}
                          </span>
                        ) : null}
                        {member.phone ? <span className="muted">{member.phone}</span> : null}
                        {member.note ? <span className="muted">{member.note}</span> : null}
                      </div>
                      {received || catchUps.length > 0 ? (
                        <div className="badges">
                          {received ? <Badge label={t('alreadyReceived')} tone="green" /> : null}
                          {catchUps.length > 0 ? <Badge label={t('catchUp')} /> : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="col-actions">
                      <ActionMenu label={t('moreActions')} emptyLabel={t('none')} items={items} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Screen>
  );
}
