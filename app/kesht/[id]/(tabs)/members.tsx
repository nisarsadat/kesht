import { useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../../../src/app-state';
import { receivedMemberIds } from '../../../../src/domain/rules';
import type { Bundle } from '../../../../src/domain/types';
import { formatMoney, formatMonth, localizeNumber } from '../../../../src/format';
import { Icon } from '../../../../src/icons';
import { ConfirmSheet } from '../../../../src/bottom-sheet';
import { radius, space } from '../../../../src/theme';
import { Avatar, Button, Card, EmptyState, IconButton, Screen, SectionTitle, Tap } from '../../../../src/ui';

export default function MembersScreen() {
  const params = useGlobalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, repo, colors, language } = useApp();
  const router = useRouter();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!repo || !id) return;
    void repo.getBundle(id).then(setBundle);
  }, [repo, id]);

  useFocusEffect(load);

  if (!bundle) return <Screen inTabs title={t('tabPeople')} showBack={false}>{null}</Screen>;

  const current = bundle;
  const locked = current.kesht.status !== 'draft';
  const canJoin = current.kesht.status === 'active';
  const closedRounds = current.rounds.filter((round) => round.status === 'closed');
  const receivedIds = receivedMemberIds(current);
  const ordered = [...current.members].sort((a, b) => a.turnOrder - b.turnOrder);
  const target = current.members.find((member) => member.id === pendingDelete);
  const hintText = canJoin ? t('joinHint') : locked ? null : t('lockedHint');

  return (
    <Screen
      inTabs
      showBack={false}
      title={t('tabPeople')}
      subtitle={t('personCount', { count: localizeNumber(ordered.length, language) })}
      footer={
        <Button
          label={t('addMember')}
          icon="plus"
          size="lg"
          onPress={() => router.push(`/kesht/${id}/member/new`)}
          disabled={locked && !canJoin}
        />
      }
    >
      {ordered.length === 0 ? (
        <EmptyState
          icon="users"
          title={t('noMembersYet')}
          body={t('equalMoney')}
          action={
            <Button
              label={t('addFirstMember')}
              icon="plus"
              onPress={() => router.push(`/kesht/${id}/member/new`)}
              disabled={locked && !canJoin}
            />
          }
        />
      ) : null}

      {hintText ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.goldSoft, borderRadius: radius.sm, padding: space.md }}>
          <Icon name="info" size={17} color={colors.gold} strokeWidth={2} />
          <Text style={{ flex: 1, color: colors.gold, fontSize: 12.5, lineHeight: 19, fontWeight: '600' }}>{hintText}</Text>
        </View>
      ) : null}

      {ordered.length > 1 && !locked ? (
        <SectionTitle title={t('members')} trailing={<Text style={{ color: colors.faint, fontSize: 11.5, fontWeight: '600' }}>{t('reorderHint')}</Text>} />
      ) : null}

      {ordered.map((member, index) => {
        const dues = closedRounds
          .map((round) => ({
            round,
            payment: current.payments.find((p) => p.roundId === round.id && p.memberId === member.id && !p.paid),
          }))
          .filter((entry) => entry.payment);
        const done = receivedIds.has(member.id);

        return (
          <Card key={member.id} style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={member.name} size={46} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }}>
                    {member.name}
                  </Text>
                  {done ? <Icon name="check" size={15} color={colors.primary} strokeWidth={2.6} /> : null}
                </View>
                <Text numberOfLines={1} style={{ color: colors.faint, fontSize: 12.5, fontWeight: '600' }}>
                  {[
                    t('turnNumber', { n: localizeNumber(index + 1, language) }),
                    member.fatherName,
                    member.phone,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View
                style={{
                  minWidth: 30,
                  height: 30,
                  paddingHorizontal: 8,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? colors.primarySoft : colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: done ? colors.primary : colors.line,
                }}
              >
                <Text style={{ color: done ? colors.primary : colors.muted, fontSize: 13, fontWeight: '800' }}>
                  {localizeNumber(index + 1, language)}
                </Text>
              </View>
            </View>

            {member.note ? (
              <View style={{ flexDirection: 'row', gap: space.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.xs, padding: space.sm + 2 }}>
                <Icon name="info" size={14} color={colors.faint} strokeWidth={2} />
                <Text style={{ flex: 1, color: colors.muted, fontSize: 12.5, lineHeight: 18, fontWeight: '500' }}>{member.note}</Text>
              </View>
            ) : null}

            {dues.map(({ round, payment }) => (
              <View
                key={payment!.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  backgroundColor: colors.goldSoft,
                  borderRadius: radius.sm,
                  paddingVertical: space.sm + 2,
                  paddingHorizontal: space.md,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '800' }}>{t('catchUp')}</Text>
                  <Text style={{ color: colors.gold, fontSize: 11.5, fontWeight: '600', opacity: 0.85 }}>
                    {formatMonth(round.year, round.month, language)} · {formatMoney(payment!.amount, language)}
                  </Text>
                </View>
                <Tap onPress={() => void repo?.setPaid(current.kesht.id, payment!.id, true).then(load)} haptic="success">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12 }}>
                    <Icon name="check" size={13} color={colors.surface} strokeWidth={2.6} />
                    <Text style={{ color: colors.surface, fontSize: 12, fontWeight: '800' }}>{t('markCatchUpPaid')}</Text>
                  </View>
                </Tap>
              </View>
            ))}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {locked ? null : (
                <>
                  <IconButton icon="arrow-up" label={t('up')} size={36} disabled={index === 0} onPress={() => void repo?.moveMember(current.kesht.id, member.id, 'up').then(load)} />
                  <IconButton
                    icon="arrow-down"
                    label={t('down')}
                    size={36}
                    disabled={index === ordered.length - 1}
                    onPress={() => void repo?.moveMember(current.kesht.id, member.id, 'down').then(load)}
                  />
                </>
              )}
              <View style={{ flex: 1 }} />
              {current.kesht.status === 'completed' ? null : (
                <IconButton icon="edit" label={t('editMember')} size={36} onPress={() => router.push(`/kesht/${id}/member/${member.id}`)} />
              )}
              {current.kesht.status === 'completed' || done ? null : (
                <IconButton icon="trash" label={t('delete')} size={36} tone="danger" haptic="warn" onPress={() => setPendingDelete(member.id)} />
              )}
            </View>
          </Card>
        );
      })}

      <ConfirmSheet
        open={Boolean(target)}
        onClose={() => setPendingDelete(null)}
        title={t('deleteMemberTitle')}
        body={target ? `${t('deleteMemberBody')}\n${target.name}` : t('deleteMemberBody')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        icon="trash"
        tone="danger"
        onConfirm={() => {
          if (!target) return;
          void repo?.removeMember(current.kesht.id, target.id).then(load);
        }}
      />
    </Screen>
  );
}
