import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { notify } from '../components/toasts';
import { Button, Card, Field, Screen } from '../components/ui';
import { store } from '../data/store';
import { formatMoney, localizeNumber } from '../lib/format';
import { useApp, useBundle } from '../state/app-state';

export function MemberFormPage() {
  const { id, memberId } = useParams<{ id: string; memberId: string }>();
  const bundle = useBundle(id);
  const { t, language, errorFrom, canEdit } = useApp();
  const navigate = useNavigate();

  const creating = memberId === 'new';
  const existing = creating ? undefined : bundle?.members.find((member) => member.id === memberId);

  const [name, setName] = useState(existing?.name ?? '');
  const [fatherName, setFatherName] = useState(existing?.fatherName ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  if (!bundle) return null;

  const keshtId = bundle.kesht.id;
  // Only the owner may change the member list.
  if (!canEdit(keshtId)) return <Navigate to={`/k/${keshtId}/members`} replace />;
  const joining = creating && bundle.kesht.status === 'active';
  const closedCount = bundle.rounds.filter((round) => round.status === 'closed').length;
  const receivedCount = bundle.members.filter((member) =>
    bundle.rounds.some((round) => round.status === 'closed' && round.recipientMemberId === member.id),
  ).length;

  function save(event: FormEvent): void {
    event.preventDefault();
    setError('');
    try {
      const input = { name, fatherName, phone, note };
      if (joining) store.joinMember(keshtId, input);
      else if (creating) store.addMember(keshtId, input);
      else if (memberId) store.updateMember(keshtId, memberId, input);
      notify(t(joining ? 'notifyMemberJoined' : creating ? 'notifyMemberAdded' : 'notifyMemberSaved'));
      navigate(`/k/${keshtId}/members`);
    } catch (caught) {
      setError(errorFrom(caught, 'name_required'));
    }
  }

  return (
    <Screen
      title={creating ? t('addMember') : t('editMember')}
      backTo={`/k/${keshtId}/members`}
      form={{ id: 'member-form', onSubmit: save }}
      footer={<Button type="submit" label={t('save')} />}
    >
      <>
        <Field label={t('name')} hint={t('required')} value={name} onChange={setName} autoFocus required />
        <Field label={t('fatherName')} hint={t('optional')} value={fatherName} onChange={setFatherName} />
        <Field label={t('phone')} hint={t('optional')} value={phone} onChange={setPhone} inputMode="tel" />
        <Field label={t('note')} hint={t('optional')} value={note} onChange={setNote} multiline />

        {joining ? (
          <Card>
            <span>
              {t('joinExplain', {
                passed: localizeNumber(closedCount, language),
                catchUp: formatMoney(closedCount * bundle.kesht.monthlyAmount, language),
                before: localizeNumber(receivedCount, language),
                after: localizeNumber(receivedCount + 1, language),
              })}
            </span>
          </Card>
        ) : null}

        {error ? <span className="danger-text">{error}</span> : null}
      </>
    </Screen>
  );
}
