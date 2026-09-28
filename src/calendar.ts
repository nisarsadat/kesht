export const SOLAR_MONTHS = [
  { fa: 'حمل', en: 'Hamal' },
  { fa: 'ثور', en: 'Sawr' },
  { fa: 'جوزا', en: 'Jawza' },
  { fa: 'سرطان', en: 'Saratan' },
  { fa: 'اسد', en: 'Asad' },
  { fa: 'سنبله', en: 'Sonbola' },
  { fa: 'میزان', en: 'Mizan' },
  { fa: 'عقرب', en: 'Aqrab' },
  { fa: 'قوس', en: 'Qaws' },
  { fa: 'جدی', en: 'Jadi' },
  { fa: 'دلو', en: 'Dalw' },
  { fa: 'حوت', en: 'Hut' },
] as const;

export function gregorianToSolar(date: Date): { year: number; month: number } {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const gDayOffset = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gDayOffset[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const month = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  return { year: jy, month };
}

export function monthLabel(month: number, language: 'fa' | 'en'): string {
  const entry = SOLAR_MONTHS[month - 1];
  return entry ? entry[language] : String(month);
}
