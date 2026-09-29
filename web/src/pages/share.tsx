import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/confirm-dialog';
import { notify } from '../components/toasts';
import { Badge, Button, Card, Field, Screen } from '../components/ui';
import {
  createInviteLink,
  inviteByEmail,
  inviteUrl,
  listCollaborators,
  listInviteLinks,
  removeCollaborator,
  revokeInviteLink,
  setCollaboratorRole,
  type AccessRole,
  type Collaborator,
  type InviteLink,
} from '../data/sharing';
import { useApp, useBundle } from '../state/app-state';

function formatDate(value: string, language: 'fa' | 'en'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SharePage() {
  const { id } = useParams<{ id: string }>();
  const bundle = useBundle(id);
  const { t, language, mode, canManage, email, authErrorFrom } = useApp();

  const [people, setPeople] = useState<Collaborator[]>([]);
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  /** The role the next invited address joins with; the owner can change it later. */
  const [inviteRole, setInviteRole] = useState<Exclude<AccessRole, 'owner'>>('member');
  const [error, setError] = useState('');
  const [pendingRemove, setPendingRemove] = useState<Collaborator | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<InviteLink | null>(null);

  const keshtId = bundle?.kesht.id;
  const manageable = keshtId ? canManage(keshtId) : false;

  const load = useCallback(async () => {
    if (!keshtId) return;
    try {
      const [nextPeople, nextLinks] = await Promise.all([listCollaborators(keshtId), listInviteLinks(keshtId)]);
      setPeople(nextPeople);
      setLinks(nextLinks);
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setLoading(false);
    }
  }, [keshtId, authErrorFrom]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!bundle || !keshtId) return null;
  // Only the owner manages access; managers and members have no business here.
  if (!manageable) return <Navigate to={`/k/${keshtId}`} replace />;

  async function invite(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!keshtId) return;
    setError('');
    if (!inviteEmail.includes('@')) {
      setError(t('emailInvalid'));
      return;
    }
    setBusy(true);
    try {
      await inviteByEmail(keshtId, inviteEmail, inviteRole);
      setInviteEmail('');
      await load();
      notify(t('notifyInviteSent'));
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function addLink(): Promise<void> {
    if (!keshtId) return;
    setError('');
    setBusy(true);
    try {
      await createInviteLink(keshtId);
      await load();
      notify(t('notifyLinkCreated'));
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      notify(t('linkCopied'));
    } catch {
      // Clipboard can be blocked; the field is there to copy by hand.
    }
  }

  async function revoke(inviteId: string): Promise<void> {
    setPendingRevoke(null);
    setError('');
    setBusy(true);
    try {
      await revokeInviteLink(inviteId);
      await load();
      notify(t('notifyLinkRevoked'));
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove(membershipId: string): Promise<void> {
    setPendingRemove(null);
    setError('');
    setBusy(true);
    try {
      await removeCollaborator(membershipId);
      await load();
      notify(t('notifyAccessRemoved'));
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(person: Collaborator, role: Exclude<AccessRole, 'owner'>): Promise<void> {
    setError('');
    setBusy(true);
    try {
      await setCollaboratorRole(person.id, role);
      await load();
      notify(t('notifyRoleChanged'));
    } catch (caught) {
      setError(authErrorFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'local') {
    return (
      <Screen title={t('shareTitle')} backTo={`/k/${keshtId}`}>
        <Card>
          <span className="muted">{t('shareCloudOnly')}</span>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={t('shareTitle')} backTo={`/k/${keshtId}`}>
      <Card>
        <span className="title-lg">{t('shareTitle')}</span>
        <span className="muted">{t('shareHint')}</span>
      </Card>

      {pendingRemove ? (
        <ConfirmDialog
          title={t('removeAccessTitle')}
          body={`${t('removeAccessBody')} ${pendingRemove.email ? `(${pendingRemove.email})` : ''}`}
          confirmLabel={t('removeAccess')}
          cancelLabel={t('back')}
          onConfirm={() => void remove(pendingRemove.id)}
          onCancel={() => setPendingRemove(null)}
        />
      ) : null}

      <Card>
        <span className="strong">{t('peopleWithAccess')}</span>
        {loading ? <span className="muted">{t('loading')}</span> : null}
        {!loading && people.length === 0 ? <span className="muted">{t('noCollaborators')}</span> : null}
        {people.map((person) => {
          const mine = person.email && email && person.email.toLowerCase() === email.toLowerCase();
          return (
            <div key={person.id} className="spread">
              <span className="person">
                <span className="strong">{person.email ?? person.userId ?? t('none')}</span>
              <span className="muted">
                {person.role === 'owner'
                  ? t('roleOwner')
                  : person.role === 'manager'
                    ? t('roleManager')
                    : t('roleMember')}{' '}
                · {person.userId ? t('joined') : t('pendingInvite')}
                {mine ? ` · ${t('you')}` : ''}
              </span>
            </span>
            {person.role === 'owner' ? (
              <Badge label={t('roleOwner')} tone="gold" />
            ) : (
              <span className="row">
                {person.role === 'manager' ? (
                  <Button
                    label={t('makeMember')}
                    tone="ghost"
                    small
                    disabled={busy}
                    onClick={() => void changeRole(person, 'member')}
                  />
                ) : (
                  <Button
                    label={t('makeManager')}
                    tone="ghost"
                    small
                    disabled={busy}
                    onClick={() => void changeRole(person, 'manager')}
                  />
                )}
                <Button label={t('removeAccess')} tone="ghost" small onClick={() => setPendingRemove(person)} />
              </span>
            )}
            </div>
          );
        })}
      </Card>

      <form className="form" onSubmit={invite}>
        <Card>
          <span className="strong">{t('inviteByEmail')}</span>
          <span className="muted">{t('memberReadOnlyHint')}</span>
          <Field label={t('email')} value={inviteEmail} onChange={setInviteEmail} type="email" />
          <span className="muted">{t('inviteAs')}</span>
          <span className="row">
            <Button
              label={t('roleMember')}
              tone={inviteRole === 'member' ? 'primary' : 'ghost'}
              small
              onClick={() => setInviteRole('member')}
            />
            <Button
              label={t('roleManager')}
              tone={inviteRole === 'manager' ? 'primary' : 'ghost'}
              small
              onClick={() => setInviteRole('manager')}
            />
          </span>
          <Button type="submit" label={t('invite')} disabled={busy} />
        </Card>
      </form>

      <Card>
        <span className="strong">{t('shareLink')}</span>
        <span className="muted">{t('shareHint')}</span>
        {links.length === 0 ? null : (
          links.map((link) => (
            <div key={link.id} className="link-row">
              <input className="input" dir="ltr" readOnly value={inviteUrl(link.token)} onFocus={(event) => event.target.select()} />
              <span className="muted">{t('linkExpires', { date: formatDate(link.expiresAt, language) })}</span>
              <div className="row">
                <Button label={t('copyLink')} tone="ghost" small onClick={() => void copy(link.token)} />
                <Button label={t('revokeLink')} tone="danger" small onClick={() => setPendingRevoke(link)} />
              </div>
            </div>
          ))
        )}
        <Button label={t('createLink')} onClick={() => void addLink()} disabled={busy} />
      </Card>

      {pendingRevoke ? (
        <ConfirmDialog
          title={t('revokeLinkTitle')}
          body={t('revokeLinkBody')}
          confirmLabel={t('revokeLink')}
          cancelLabel={t('back')}
          onConfirm={() => void revoke(pendingRevoke.id)}
          onCancel={() => setPendingRevoke(null)}
        />
      ) : null}

      {error ? <span className="danger-text">{error}</span> : null}
    </Screen>
  );
}
