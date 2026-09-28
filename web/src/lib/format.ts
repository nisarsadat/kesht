import { monthLabel } from './calendar';
import type { Language } from '../domain/types';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const ASCII_DIGITS: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

/** Lets someone type ۱۰۰۰ (Dari) or ١٠٠٠ (Arabic) into a number field. */
export function toEnglishDigits(value: string): string {
  return value.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (digit) => ASCII_DIGITS[digit] ?? digit);
}

/** Parses a user-typed amount, tolerating digit variants, spaces and commas. */
export function parseAmount(value: string): number {
  const cleaned = toEnglishDigits(value).replace(/[\s,٫]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
}

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
