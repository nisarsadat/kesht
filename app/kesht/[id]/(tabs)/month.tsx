import { useFocusEffect, useGlobalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../../../src/app-state';
import { ConfirmSheet } from '../../../../src/bottom-sheet';
import { collectedAmount, eligibleRecipients, receivedMemberIds } from '../../../../src/domain/rules';
import type { Bundle } from '../../../../src/domain/types';
import { KeshtRuleError } from '../../../../src/domain/types';
import { formatMoney, formatMonth, localizeNumber } from '../../../../src/format';
import { Icon } from '../../../../src/icons';
import { radius, space } from '../../../../src/theme';
import { Avatar, Badge, Button, Card, EmptyState, ErrorBanner, ListRow, ProgressBar, Screen, SectionTitle } from '../../../../src/ui';

export default function MonthScreen() {
  const params = useGlobalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t, repo, language, errorText, colors } = useApp();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    if (!repo || !id) return;
    void repo.getBundle(id).then(setBundle);
  }, [repo, id]);

  useFocusEffect(load);

  if (!bundle) return <Screen inTabs title={t('tabMonth')} showBack={false}>{null}</Screen>;

  const round = bundle.rounds.find((item) => item.status === 'open');
  if (!round) {
    return (
      <Screen inTabs title={t('tabMonth')} showBack={false}>
        <EmptyState
          icon={bundle.kesht.status === 'completed' ? 'check' : 'calendar'}
          title={t('noOpenMonth')}
          body={bundle.kesht.status === 'completed' ? t('completedBody') : t('startHint')}
        />
      </Screen>
    );
  }

  const monthRound = round;
  const current = bundle;
  const payments = current.payments.filter((payment) => payment.roundId === round.id);
  const received = receivedMemberIds(current);
  const eligible = eligibleRecipients(current);
  const recipient = current.members.find((member) => member.id === round.recipientMemberId);
  const expected = current.members.length * current.kesht.monthlyAmount;
  const collected = collectedAmount(current, round.id);
  const paidCount = payments.filter((payment) => payment.paid).length;
  const unpaid = payments.some((payment) => !payment.paid);

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
      load();
    } catch (caught) {
      setError(caught instanceof KeshtRuleError ? errorText(caught.code) : t('round_not_open'));
    }
  }

  return (
    <Screen
      inTabs
      showBack={false}
      title={t('tabMonth')}
      subtitle={formatMonth(monthRound.year, monthRound.month, language)}
      footer={
        <Button
          label={recipient ? t('payOut') : t('chooseRecipient')}
          icon="gift"
          size="lg"
          disabled={!monthRound.recipientMemberId}
          onPress={() => setConfirming(true)}
        />
      }
    >
      <Card glow>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Badge label={formatMonth(monthRound.year, monthRound.month, language)} tone="primary" icon="calendar" />
          <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '700' }}>
            {t('paidProgress', { paid: localizeNumber(paidCount, language), total: localizeNumber(payments.length, language) })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.xs }}>
          <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1 }}>
            {formatMoney(collected, language)}
          </Text>
        </View>
        <Text style={{ color: colors.faint, fontSize: 12.5, fontWeight: '600' }}>
          {t('expectedPot')}: {formatMoney(expected, language)}
        </Text>
        <ProgressBar value={expected > 0 ? collected / expected : 0} />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            marginTop: space.xs,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.sm,
            padding: space.md,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          {recipient ? <Avatar name={recipient.name} size={38} /> : (
            <View style={{ width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfacePress }}>
              <Icon name="gift" size={18} color={colors.faint} strokeWidth={1.9} />
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700' }}>{t('receives')}</Text>
            <Text numberOfLines={1} style={{ color: recipient ? colors.ink : colors.faint, fontSize: 15, fontWeight: '800' }}>
              {recipient?.name ?? t('none')}
            </Text>
          </View>
          {recipient ? <Icon name="crown" size={19} color={colors.gold} strokeWidth={1.9} /> : null}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label={t('markAllPaid')} icon="check" tone="soft" size="sm" onPress={() => void run(() => repo!.setAllPaid(current.kesht.id, true))} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t('clearPaid')} icon="close" tone="ghost" size="sm" onPress={() => void run(() => repo!.setAllPaid(current.kesht.id, false))} />
        </View>
      </View>

      <SectionTitle title={t('members')} trailing={<Text style={{ color: colors.faint, fontSize: 11.5, fontWeight: '600' }}>{t('tapToToggle')}</Text>} />
      {payments.map((payment) => {
        const member = current.members.find((item) => item.id === payment.memberId);
        const already = member ? received.has(member.id) : false;
        return (
          <ListRow
            key={payment.id}
            onPress={() => void run(() => repo!.setPaid(current.kesht.id, payment.id, !payment.paid))}
            selected={payment.paid}
            leading={member ? <Avatar name={member.name} size={40} /> : undefined}
            title={member?.name ?? t('none')}
            subtitle={already ? `${t('alreadyReceived')} — ${t('stillPays')}` : formatMoney(payment.amount, language)}
            trailing={
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: payment.paid ? colors.primary : 'transparent',
                  borderWidth: payment.paid ? 0 : 1.6,
                  borderColor: colors.line,
                }}
              >
                {payment.paid ? <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} /> : null}
              </View>
            }
          />
        );
      })}

      <SectionTitle title={t('chooseRecipient')} trailing={<Text style={{ color: colors.faint, fontSize: 12, fontWeight: '700' }}>{localizeNumber(eligible.length, language)}</Text>} />
      {eligible.length === 0 ? (
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 20, fontWeight: '500' }}>{t('nobodyLeft')}</Text>
        </Card>
      ) : (
        eligible.map((member, index) => {
          const selected = member.id === monthRound.recipientMemberId;
          return (
            <ListRow
              key={member.id}
              selected={selected}
              onPress={() => void run(() => repo!.setRecipient(current.kesht.id, member.id))}
              leading={<Avatar name={member.name} size={40} />}
              title={member.name}
              subtitle={index === 0 ? t('suggested') : t('turnNumber', { n: localizeNumber(member.turnOrder, language) })}
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
        })
      )}

      <ErrorBanner message={error} />

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={unpaid ? t('unpaidTitle') : t('closeTitle')}
        body={unpaid ? t('unpaidBody') : `${t('closeBody')}\n${recipient?.name ?? ''} · ${formatMoney(collected, language)}`}
        confirmLabel={t('closeMonth')}
        cancelLabel={t('cancel')}
        icon="gift"
        tone={unpaid ? 'danger' : 'primary'}
        onConfirm={() => void run(() => repo!.closeRound(current.kesht.id))}
      />
    </Screen>
  );
}
