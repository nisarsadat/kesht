import { useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../../../src/app-state';
import { collectedAmount, expectedPot, nextInOrder, receivedMemberIds } from '../../../../src/domain/rules';
import type { Bundle } from '../../../../src/domain/types';
import { KeshtRuleError } from '../../../../src/domain/types';
import { formatMoney, formatMonth, localizeNumber } from '../../../../src/format';
import { Icon } from '../../../../src/icons';
import { radius, space } from '../../../../src/theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ListRow,
  ProgressRing,
  Screen,
  SectionTitle,
  StatTile,
  statusTone,
} from '../../../../src/ui';

export default function KeshtHomeScreen() {
  const params = useGlobalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, repo, language, errorText, colors } = useApp();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!repo || !id) return;
    void repo.getBundle(id).then(setBundle);
  }, [repo, id]);

  useFocusEffect(load);

  if (!bundle) return <Screen inTabs title={t('appName')} showBack={false}>{null}</Screen>;

  const current = bundle;
  const total = current.members.length;
  const received = receivedMemberIds(current);
  const next = nextInOrder(current);
  const open = current.rounds.find((round) => round.status === 'open');
  const receivedMembers = [...current.members].filter((member) => received.has(member.id)).sort((a, b) => a.turnOrder - b.turnOrder);
  const isComplete = current.kesht.status === 'completed';
  const progress = isComplete ? 1 : open && total > 0 ? open.sequence / total : 0;

  async function start() {
    if (!repo) return;
    setError('');
    try {
      await repo.startKesht(current.kesht.id);
      load();
    } catch (caught) {
      setError(caught instanceof KeshtRuleError ? errorText(caught.code) : t('need_two_members'));
    }
  }

  return (
    <Screen title={current.kesht.name} subtitle={formatMoney(current.kesht.monthlyAmount, language)} inTabs showBack={false}>
      <Card glow>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ProgressRing value={progress} size={116} thickness={10}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -1 }}>
                {localizeNumber(isComplete ? total : (open?.sequence ?? 0), language)}
              </Text>
              <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700' }}>
                / {localizeNumber(total, language)}
              </Text>
            </View>
          </ProgressRing>

          <View style={{ flex: 1, gap: space.sm }}>
            <Badge label={t(current.kesht.status)} tone={statusTone(current.kesht.status)} icon={isComplete ? 'check' : 'sparkle'} />
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', lineHeight: 19 }}>
              {t('personCount', { count: localizeNumber(total, language) })} · {t('months', { count: localizeNumber(total, language) })}
            </Text>
            {open ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="calendar" size={14} color={colors.primary} strokeWidth={2} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
                  {formatMonth(open.year, open.month, language)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <StatTile label={t('expectedPot')} value={formatMoney(expectedPot(current), language)} icon="coins" tone="gold" />
        <StatTile
          label={t('collected')}
          value={formatMoney(open ? collectedAmount(current, open.id) : 0, language)}
          icon="trending"
          tone="primary"
        />
      </View>

      {current.kesht.status === 'draft' ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldSoft }}>
              <Icon name="info" size={20} color={colors.gold} strokeWidth={1.9} />
            </View>
            <Text style={{ flex: 1, color: colors.muted, fontSize: 13.5, lineHeight: 20, fontWeight: '500' }}>{t('startHint')}</Text>
          </View>
          {total < 2 ? <Text style={{ color: colors.faint, fontSize: 12.5, fontWeight: '600' }}>{t('needTwoHint')}</Text> : null}
          <Button label={t('start')} icon="sparkle" size="lg" onPress={() => void start()} disabled={total < 2} />
        </Card>
      ) : null}

      {!isComplete && next ? (
        <>
          <SectionTitle title={t('nextRecipient')} />
          <ListRow
            leading={<Avatar name={next.name} size={44} />}
            title={next.name}
            subtitle={next.fatherName ? `${t('fatherName')}: ${next.fatherName}` : t('suggested')}
            trailing={
              <View style={{ width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
                <Icon name="crown" size={17} color={colors.primary} strokeWidth={1.9} />
              </View>
            }
          />
        </>
      ) : null}

      <SectionTitle
        title={t('whoReceived')}
        trailing={<Text style={{ color: colors.faint, fontSize: 12, fontWeight: '700' }}>{localizeNumber(receivedMembers.length, language)}</Text>}
      />
      {isComplete ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
              <Icon name="check" size={20} color={colors.primary} strokeWidth={2.2} />
            </View>
            <Text style={{ flex: 1, color: colors.muted, fontSize: 13.5, lineHeight: 20, fontWeight: '500' }}>{t('completedBody')}</Text>
          </View>
        </Card>
      ) : null}
      {receivedMembers.length === 0 && !isComplete ? (
        <EmptyState icon="gift" title={t('notYet')} body={t('spinHint')} />
      ) : (
        receivedMembers.map((member, index) => (
          <ListRow
            key={member.id}
            leading={<Avatar name={member.name} size={38} />}
            title={member.name}
            subtitle={t('turnNumber', { n: localizeNumber(index + 1, language) })}
            trailing={<Icon name="check" size={18} color={colors.primary} strokeWidth={2.4} />}
          />
        ))
      )}

      <ErrorBanner message={error} />
    </Screen>
  );
}
