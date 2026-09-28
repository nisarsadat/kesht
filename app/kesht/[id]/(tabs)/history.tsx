import { useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../../../src/app-state';
import { collectedAmount } from '../../../../src/domain/rules';
import type { Bundle } from '../../../../src/domain/types';
import { formatMoney, formatMonth, localizeNumber } from '../../../../src/format';
import { Icon } from '../../../../src/icons';
import { radius, space } from '../../../../src/theme';
import { Avatar, Card, EmptyState, Screen, SectionTitle, StatTile } from '../../../../src/ui';

export default function HistoryScreen() {
  const params = useGlobalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, repo, language, colors } = useApp();
  const [bundle, setBundle] = useState<Bundle | null>(null);

  const load = useCallback(() => {
    if (!repo || !id) return;
    void repo.getBundle(id).then(setBundle);
  }, [repo, id]);

  useFocusEffect(load);

  if (!bundle) return <Screen inTabs title={t('tabHistory')} showBack={false}>{null}</Screen>;

  const current = bundle;
  const closed = [...current.rounds].filter((round) => round.status === 'closed').sort((a, b) => a.sequence - b.sequence);
  const totalPaid = closed.reduce((sum, round) => sum + collectedAmount(current, round.id), 0);

  if (closed.length === 0) {
    return (
      <Screen inTabs title={t('tabHistory')} showBack={false}>
        <EmptyState icon="history" title={t('noHistory')} body={t('tagline')} />
      </Screen>
    );
  }

  return (
    <Screen
      inTabs
      showBack={false}
      title={t('tabHistory')}
      subtitle={t('roundLabel', { n: localizeNumber(closed.length, language) })}
    >
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <StatTile label={t('timeline')} value={localizeNumber(closed.length, language)} icon="history" tone="primary" />
        <StatTile label={t('payout')} value={formatMoney(totalPaid, language)} icon="coins" tone="gold" />
      </View>

      <SectionTitle title={t('timeline')} />

      {closed.map((round, index) => {
        const recipient = current.members.find((member) => member.id === round.recipientMemberId);
        const isLast = index === closed.length - 1;
        return (
          <View key={round.id} style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ alignItems: 'center', width: 34 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.primarySoft,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
                  {localizeNumber(round.sequence, language)}
                </Text>
              </View>
              {!isLast ? <View style={{ flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 4 }} /> : null}
            </View>

            <View style={{ flex: 1, paddingBottom: isLast ? 0 : space.sm }}>
              <Card>
                <Text style={{ color: colors.faint, fontSize: 11.5, fontWeight: '700' }}>
                  {formatMonth(round.year, round.month, language)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  {recipient ? <Avatar name={recipient.name} size={40} /> : null}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700' }}>{t('receivedBy')}</Text>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 15.5, fontWeight: '800', letterSpacing: -0.3 }}>
                      {recipient?.name ?? t('none')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Icon name="coins" size={15} color={colors.gold} strokeWidth={2} />
                    <Text style={{ color: colors.gold, fontSize: 13, fontWeight: '800' }}>
                      {formatMoney(collectedAmount(current, round.id), language)}
                    </Text>
                  </View>
                </View>
              </Card>
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
