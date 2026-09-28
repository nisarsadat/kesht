import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../../../src/app-state';
import type { Bundle } from '../../../../src/domain/types';
import { KeshtRuleError } from '../../../../src/domain/types';
import { formatMoney, localizeNumber } from '../../../../src/format';
import { Icon } from '../../../../src/icons';
import { radius, space } from '../../../../src/theme';
import { Avatar, Button, Card, ErrorBanner, Field, Screen, StatTile } from '../../../../src/ui';

export default function MemberFormScreen() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();
  const creating = memberId === 'new';
  const { t, repo, errorText, colors, language } = useApp();
  const router = useRouter();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!repo || !id) return;
    void repo.getBundle(id).then((loaded) => {
      setBundle(loaded);
      if (creating || !loaded) return;
      const member = loaded.members.find((item) => item.id === memberId);
      if (!member) return;
      setName(member.name);
      setFatherName(member.fatherName ?? '');
      setPhone(member.phone ?? '');
      setNote(member.note ?? '');
    });
  }, [repo, id, memberId, creating]);

  async function save() {
    if (!repo || !id) return;
    setError('');
    const input = { name, fatherName, phone, note };
    try {
      if (creating && bundle?.kesht.status === 'active') await repo.joinMember(id, input);
      else if (creating) await repo.addMember(id, input);
      else await repo.updateMember(id, memberId, input);
      router.back();
    } catch (caught) {
      setError(caught instanceof KeshtRuleError ? errorText(caught.code) : t('name_required'));
    }
  }

  const joining = creating && bundle?.kesht.status === 'active';
  const passed = bundle?.rounds.filter((round) => round.status === 'closed').length ?? 0;
  const stillWaiting = bundle
    ? bundle.members.filter((member) => !bundle.rounds.some((round) => round.status === 'closed' && round.recipientMemberId === member.id)).length
    : 0;

  return (
    <Screen title={creating ? t('addMember') : t('editMember')} footer={<Button label={t('save')} icon="check" size="lg" onPress={() => void save()} />}>
      <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.sm }}>
        <Avatar name={name.trim() || '?'} size={82} />
        <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '600' }}>{t('equalMoney')}</Text>
      </View>

      <Field label={t('name')} hint={t('required')} value={name} onChangeText={setName} />
      <Field label={t('fatherName')} hint={t('optional')} value={fatherName} onChangeText={setFatherName} />
      <Field label={t('phone')} hint={t('optional')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label={t('note')} hint={t('optional')} value={note} onChangeText={setNote} multiline />

      {joining && bundle ? (
        <Card glow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldSoft }}>
              <Icon name="info" size={18} color={colors.gold} strokeWidth={2} />
            </View>
            <Text style={{ flex: 1, color: colors.gold, fontSize: 13, fontWeight: '800' }}>{t('catchUp')}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '500' }}>
            {t('joinExplain', {
              passed: localizeNumber(passed, language),
              catchUp: formatMoney(passed * bundle.kesht.monthlyAmount, language),
              before: localizeNumber(stillWaiting, language),
              after: localizeNumber(stillWaiting + 1, language),
            })}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <StatTile label={t('catchUp')} value={formatMoney(passed * bundle.kesht.monthlyAmount, language)} icon="coins" tone="gold" />
            <StatTile label={t('remaining')} value={localizeNumber(stillWaiting + 1, language)} icon="calendar" tone="primary" />
          </View>
        </Card>
      ) : null}

      <ErrorBanner message={error} />
    </Screen>
  );
}
