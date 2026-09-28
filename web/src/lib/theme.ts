export type ThemeName = 'light' | 'dark';

export type Palette = {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  green: string;
  greenSoft: string;
  onGreen: string;
  gold: string;
  goldSoft: string;
  danger: string;
  dangerSoft: string;
  white: string;
  shadow: string;
};

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#F3F0E8',
    card: '#FFFFFF',
    ink: '#1A1814',
    muted: '#6B6560',
    line: '#E4DDD2',
    green: '#0C6B52',
    greenSoft: '#E5F5EF',
    onGreen: '#FFFFFF',
    gold: '#8C6A2F',
    goldSoft: '#F8F1DE',
    danger: '#9F1239',
    dangerSoft: '#FDE8EE',
    white: '#FFFFFF',
    shadow: '#1A1814',
  },
  dark: {
    bg: '#101412',
    card: '#1B2420',
    ink: '#F6F3EC',
    muted: '#B7B1A8',
    line: '#2C3833',
    green: '#3DDC97',
    greenSoft: '#16352C',
    onGreen: '#06281C',
    gold: '#E6C98A',
    goldSoft: '#3A3120',
    danger: '#FB7185',
    dangerSoft: '#3F1D28',
    white: '#FFFFFF',
    shadow: '#000000',
  },
};

export function paletteFor(theme: ThemeName): Palette {
  return palettes[theme];
}
