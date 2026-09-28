import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../src/app-state';
import type { KeshtSummary } from '../src/domain/types';
import { formatMoney, localizeNumber } from '../src/format';
import { Icon } from '../src/icons';
import { radius, space } from '../src/theme';
import { Badge, Button, Card, EmptyState, ProgressBar, Screen, SectionTitle, statusTone } from '../src/ui';

export default function HomeScreen() {
  const { t, repo, language, colors } = useApp();
  const router = useRouter();
  const [items, setItems] = useState<KeshtSummary[]>([]);

  const load = useCallback(() => {
    if (!repo) return;
    void repo.listKeshts().then(setItems);
  }, [repo]);

  useFocusEffect(load);

  return (
    <Screen title={t('appName')} subtitle={t('tagline')} showBack={false} footer={<Button label={t('newKesht')} icon="plus" size="lg" onPress={() => router.push('/kesht/new')} />}>
      {items.length === 0 ? (
        <EmptyState
          icon="coins"
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={<Button label={t('newKesht')} icon="plus" onPress={() => router.push('/kesht/new')} />}
        />
      ) : (
        <>
          <SectionTitle title={t('allKeshts')} trailing={<Text style={{ color: colors.faint, fontSize: 12, fontWeight: '700' }}>{localizeNumber(items.length, language)}</Text>} />
          {items.map((item) => {
            const progress = item.openSequence && item.memberCount > 0 ? item.openSequence / item.memberCount : 0;
            return (
              <Card key={item.id} onPress={() => router.push(`/kesht/${item.id}`)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.primarySoft,
                    }}
                  >
                    <Icon name="coins" size={22} color={colors.primary} strokeWidth={1.9} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.faint, fontSize: 12.5, fontWeight: '600' }}>
                      {formatMoney(item.monthlyAmount, language)} · {t('personCount', { count: localizeNumber(item.memberCount, language) })}
                    </Text>
                  </View>
                  <Badge label={t(item.status)} tone={statusTone(item.status)} />
                </View>

                {item.openSequence ? (
                  <View style={{ gap: 6, marginTop: space.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: '700' }}>{t('overallProgress')}</Text>
                      <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: '800' }}>
                        {t('monthProgress', {
                          current: localizeNumber(item.openSequence, language),
                          total: localizeNumber(item.memberCount, language),
                        })}
                      </Text>
                    </View>
                    <ProgressBar value={progress} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
