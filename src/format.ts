import { monthLabel } from './calendar';
import type { Language } from './domain/types';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function localizeNumber(value: number, language: Language): string {
  const grouped = value.toLocaleString('en-US');
  if (language === 'en') return grouped;
  return grouped.replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
}

export function formatMoney(amount: number, language: Language): string {
  const number = localizeNumber(amount, language);
  return language === 'fa' ? `${number} افغانی` : `${number} AFN`;
}

export function formatMonth(year: number, month: number, language: Language): string {
  return `${monthLabel(month, language)} ${localizeNumber(year, language)}`;
}
