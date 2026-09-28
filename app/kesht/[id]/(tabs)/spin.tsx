import { useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../../../src/app-state';
import { eligibleRecipients } from '../../../../src/domain/rules';
import type { Bundle } from '../../../../src/domain/types';
import { KeshtRuleError } from '../../../../src/domain/types';
import { localizeNumber } from '../../../../src/format';
import { Icon } from '../../../../src/icons';
import { PrizeWheel } from '../../../../src/prize-wheel';
import { radius, space } from '../../../../src/theme';
import { Avatar, Button, Card, EmptyState, ErrorBanner, ListRow, Screen, SectionTitle } from '../../../../src/ui';

export default function SpinScreen() {
  const params = useGlobalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, repo, errorText, colors, language } = useApp();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [manualId, setManualId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!repo || !id) return;
    void repo.getBundle(id).then(setBundle);
  }, [repo, id]);

  useFocusEffect(load);

  if (!bundle) return <Screen inTabs title={t('tabSpin')} showBack={false}>{null}</Screen>;

  const current = bundle;
  const round = current.rounds.find((item) => item.status === 'open');
  const eligible = eligibleRecipients(current);
  const currentRecipient = current.members.find((member) => member.id === round?.recipientMemberId);

  async function assign(memberId: string) {
    if (!repo) return;
    setError('');
    try {
      await repo.setRecipient(current.kesht.id, memberId);
      load();
    } catch (caught) {
      setError(caught instanceof KeshtRuleError ? errorText(caught.code) : t('round_not_open'));
    }
  }

  if (!round) {
    return (
      <Screen inTabs title={t('tabSpin')} showBack={false}>
        <EmptyState
          icon={current.kesht.status === 'completed' ? 'check' : 'calendar'}
          title={t('noOpenMonth')}
          body={current.kesht.status === 'completed' ? t('completedBody') : t('startHint')}
        />
      </Screen>
    );
  }

  if (eligible.length === 0) {
    return (
      <Screen inTabs title={t('tabSpin')} showBack={false}>
        <EmptyState icon="check" title={t('nobodyLeft')} body={t('completedBody')} />
      </Screen>
    );
  }

  const announced = winnerName ?? currentRecipient?.name;

  return (
    <Screen inTabs showBack={false} title={t('tabSpin')} subtitle={t('personCount', { count: localizeNumber(eligible.length, language) })}>
      <Card glow style={{ alignItems: 'center', gap: space.lg }}>
        <View style={{ gap: 6, alignItems: 'center' }}>
          <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>{t('spinTitle')}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '500', textAlign: 'center' }}>{t('spinHint')}</Text>
        </View>

        <PrizeWheel
          names={eligible.map((member) => member.name)}
          disabled={spinning}
          label={spinning ? t('spinning') : winnerName ? t('spinAgain') : t('spinNow')}
          onResult={(index) => {
            const person = eligible[index];
            if (!person) return;
            setSpinning(true);
            setWinnerName(person.name);
            void assign(person.id).finally(() => setSpinning(false));
          }}
        />

        {announced ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              alignSelf: 'stretch',
              backgroundColor: colors.primarySoft,
              borderRadius: radius.md,
              padding: space.md,
              borderWidth: 1,
              borderColor: colors.primary,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
              <Icon name="crown" size={20} color={colors.onPrimary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700' }}>{t('assignedTo')}</Text>
              <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }}>
                {winnerName ? t('winnerAnnounce', { name: announced }) : announced}
              </Text>
            </View>
          </View>
        ) : null}
      </Card>

      <SectionTitle title={t('giveSpecific')} trailing={<Text style={{ color: colors.faint, fontSize: 11.5, fontWeight: '600' }}>{t('pickPerson')}</Text>} />
      {eligible.map((member) => {
        const selected = manualId === member.id;
        return (
          <ListRow
            key={member.id}
            selected={selected}
            onPress={() => setManualId(member.id)}
            leading={<Avatar name={member.name} size={40} />}
            title={member.name}
            subtitle={t('turnNumber', { n: localizeNumber(member.turnOrder, language) })}
            trailing={
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? colors.primary : 'transparent',
                  borderWidth: selected ? 0 : 1.6,
                  borderColor: colors.line,
                }}
              >
                {selected ? <Icon name="check" size={13} color={colors.onPrimary} strokeWidth={3} /> : null}
              </View>
            }
          />
        );
      })}

      <Button label={t('giveThisPerson')} icon="gift" size="lg" disabled={!manualId || spinning} onPress={() => manualId && void assign(manualId)} />

      <ErrorBanner message={error} />
    </Screen>
  );
}
