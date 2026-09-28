import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../../src/app-state';
import { gregorianToSolar, monthLabel, SOLAR_MONTHS } from '../../src/calendar';
import { KeshtRuleError } from '../../src/domain/types';
import { formatMoney, localizeNumber } from '../../src/format';
import { Icon } from '../../src/icons';
import { radius, space } from '../../src/theme';
import { Button, Card, Chip, ErrorBanner, Field, Screen, SectionTitle } from '../../src/ui';

const today = gregorianToSolar(new Date());
const PRESETS = [500, 1000, 2000, 5000, 10000];

export default function NewKeshtScreen() {
  const { t, repo, language, errorText, colors } = useApp();
  const router = useRouter();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('1000');
  const [year, setYear] = useState(String(today.year));
  const [month, setMonth] = useState(today.month);
  const [error, setError] = useState('');

  async function save() {
    if (!repo) return;
    setError('');
    try {
      const id = await repo.createKesht({
        name,
        monthlyAmount: Number(amount),
        startYear: Number(year),
        startMonth: month,
      });
      router.replace(`/kesht/${id}`);
    } catch (caught) {
      setError(caught instanceof KeshtRuleError ? errorText(caught.code) : t('month_invalid'));
    }
  }

  const numericAmount = Number(amount);
  const previewValid = name.trim().length > 0 && Number.isFinite(numericAmount) && numericAmount > 0;

  return (
    <Screen title={t('newKesht')} footer={<Button label={t('createAndAdd')} icon="plus" size="lg" onPress={() => void save()} />}>
      <Field label={t('keshtName')} hint={t('required')} value={name} onChangeText={setName} placeholder={t('keshtName')} />

      <View style={{ gap: space.sm }}>
        <Field label={t('monthlyAmount')} value={amount} onChangeText={setAmount} keyboardType="number-pad" />
        <SectionTitle title={t('quickAmounts')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {PRESETS.map((preset) => (
            <Chip key={preset} label={formatMoney(preset, language)} selected={amount === String(preset)} onPress={() => setAmount(String(preset))} />
          ))}
        </View>
      </View>

      <Field label={t('year')} value={year} onChangeText={setYear} keyboardType="number-pad" />

      <View style={{ gap: space.sm }}>
        <SectionTitle title={t('startMonth')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {SOLAR_MONTHS.map((entry, index) => (
            <Chip key={entry.en} label={entry[language]} selected={month === index + 1} onPress={() => setMonth(index + 1)} />
          ))}
        </View>
      </View>

      {previewValid ? (
        <Card glow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primarySoft,
              }}
            >
              <Icon name="sparkle" size={21} color={colors.primary} strokeWidth={1.9} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }}>
                {name}
              </Text>
              <Text style={{ color: colors.faint, fontSize: 12.5, fontWeight: '600' }}>
                {formatMoney(numericAmount, language)} · {monthLabel(month, language)} {localizeNumber(Number(year), language)}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
    </Screen>
  );
}
