import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PrizeWheel } from '../components/prize-wheel';
import { WinnerDialog } from '../components/winner-dialog';
import { Button, Card, Screen } from '../components/ui';
import { store } from '../data/store';
import { eligibleRecipients } from '../domain/rules';
import { formatMoney, localizeNumber } from '../lib/format';
import { useApp, useBundle } from '../state/app-state';

function initial(name: string): string {
  return name.trim().charAt(0) || '؟';
}

export function SpinPage() {
  const { id } = useParams<{ id: string }>();
  const bundle = useBundle(id);
  const { t, language, errorFrom, canEdit } = useApp();
  const [error, setError] = useState('');
  const [winner, setWinner] = useState<string | null>(null);
  const [manualId, setManualId] = useState<string | null>(null);

  if (!bundle) return null;

  const keshtId = bundle.kesht.id;
  const editable = canEdit(keshtId);
  const round = bundle.rounds.find((item) => item.status === 'open') ?? null;
  const eligible = eligibleRecipients(bundle);
  const currentRecipient = bundle.members.find((member) => member.id === round?.recipientMemberId);
  const pot = bundle.kesht.monthlyAmount * bundle.members.length;

  /** Records the recipient and celebrates the name on a popup. */
  function assign(memberId: string, name: string): void {
    setError('');
    try {
      store.setRecipient(keshtId, memberId);
      setWinner(name);
    } catch (caught) {
      setError(errorFrom(caught, 'round_not_open'));
    }
  }

  if (!round) {
    return (
      <Screen title={t('tabSpin')} inTabs backTo={`/k/${keshtId}`}>
        <span className="muted">{bundle.kesht.status === 'completed' ? t('completedBody') : t('noOpenMonth')}</span>
      </Screen>
    );
  }

  /* Someone this kesht was shared with can see who receives, but only the
   * owner draws the name or gives it to somebody specific. */
  if (!editable) {
    return (
      <Screen title={t('tabSpin')} inTabs backTo={`/k/${keshtId}`}>
        <span className="muted">{t('readOnly')}</span>
        <Card>
          <span>
            {t('receives')}: {currentRecipient?.name ?? t('none')}
          </span>
        </Card>
      </Screen>
    );
  }

  if (eligible.length === 0) {
    return (
      <Screen title={t('tabSpin')} inTabs backTo={`/k/${keshtId}`}>
        <span className="muted">{t('nobodyLeft')}</span>
      </Screen>
    );
  }

  return (
    <Screen title={t('tabSpin')} inTabs backTo={`/k/${keshtId}`}>
      <div className="spin-hero">
        <span className="spin-hero-kicker">{t('spinDraw')}</span>
        <span className="spin-hero-title">{t('spinTitle')}</span>
        <span className="spin-hero-hint">{t('spinHint')}</span>
        <span className="rule-note">{t('noDoubleWin')}</span>
        <PrizeWheel
          names={eligible.map((member) => member.name)}
          label={t('spinNow')}
          busyLabel={t('spinning')}
          onResult={(index) => {
            const person = eligible[index];
            if (!person) return;
            assign(person.id, person.name);
          }}
        />
        <div className="spin-stats">
          <div className="spin-stat">
            <span className="spin-stat-value">{localizeNumber(eligible.length, language)}</span>
            <span className="spin-stat-label">{t('spinEligibleLabel')}</span>
          </div>
          <span className="spin-stats-div" aria-hidden="true" />
          <div className="spin-stat">
            <span className="spin-stat-value">{formatMoney(pot, language)}</span>
            <span className="spin-stat-label">{t('spinPotLabel')}</span>
          </div>
        </div>
      </div>

      {currentRecipient ? (
        <div className="spin-recipient">
          <span className="spin-recipient-label">{t('receives')}</span>
          <span className="spin-recipient-name">{currentRecipient.name}</span>
        </div>
      ) : null}

      <Card>
        <span className="title-lg">{t('giveSpecific')}</span>
        <span className="muted">{t('pickPerson')}</span>
        <div className="spin-picks">
          {eligible.map((member) => {
            const selected = manualId === member.id;
            return (
              <button
                key={member.id}
                type="button"
                className={`spin-pick${selected ? ' selected' : ''}`}
                aria-pressed={selected}
                onClick={() => setManualId(member.id)}
              >
                <span className="spin-avatar" aria-hidden="true">
                  {initial(member.name)}
                </span>
                <span className="spin-pick-name">{member.name}</span>
                <span className="spin-radio" aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <Button
          label={t('giveThisPerson')}
          disabled={!manualId}
          onClick={() => {
            if (!manualId) return;
            const person = eligible.find((member) => member.id === manualId);
            assign(manualId, person?.name ?? '');
          }}
        />
      </Card>

      {error ? <span className="danger-text">{error}</span> : null}

      {winner ? (
        <WinnerDialog
          name={winner}
          kicker={t('spinResult')}
          amountLabel={t('spinPotLabel')}
          amount={formatMoney(pot, language)}
          closeLabel={t('close')}
          onClose={() => setWinner(null)}
        />
      ) : null}
    </Screen>
  );
}
