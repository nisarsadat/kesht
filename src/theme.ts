export type ThemeName = 'light' | 'dark';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfacePress: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  onPrimary: string;
  gold: string;
  goldSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  glow: string;
  shadow: string;
  overlay: string;
  gradient: [string, string];
  wheel: string[];
};

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    bg: '#070B09',
    surface: '#0F1613',
    surfaceAlt: '#161F1B',
    surfacePress: '#1E2A24',
    ink: '#F1F6F2',
    muted: '#9DABA2',
    faint: '#6A7A71',
    line: '#213029',
    primary: '#3DDC97',
    primaryDeep: '#0C6B52',
    primarySoft: '#12312A',
    onPrimary: '#04241A',
    gold: '#E8C87E',
    goldSoft: '#2E2718',
    danger: '#FF7186',
    dangerSoft: '#3A1720',
    success: '#3DDC97',
    glow: '#3DDC97',
    shadow: '#000000',
    overlay: 'rgba(2,6,4,0.72)',
    gradient: ['#1FBF86', '#3DDC97'],
    wheel: ['#3DDC97', '#E8C87E', '#5BB8FF', '#FF8FA3', '#B39DFF', '#5FE3D0', '#FFB86B', '#8FD14F'],
  },
  light: {
    bg: '#F2F5F2',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F8F5',
    surfacePress: '#E8EEE9',
    ink: '#0C1411',
    muted: '#5A6A61',
    faint: '#8A988F',
    line: '#DFE7E1',
    primary: '#0A8A62',
    primaryDeep: '#075C42',
    primarySoft: '#E2F4EC',
    onPrimary: '#FFFFFF',
    gold: '#9A7426',
    goldSoft: '#F7EFDC',
    danger: '#C41E45',
    dangerSoft: '#FBE5EA',
    success: '#0A8A62',
    glow: '#0A8A62',
    shadow: '#0C1411',
    overlay: 'rgba(12,20,17,0.45)',
    gradient: ['#0A8A62', '#1FBF86'],
    wheel: ['#0A8A62', '#C89A3C', '#3E86C9', '#D2617A', '#7A63D6', '#2BA795', '#D98A3E', '#6FA82F'],
  },
};

export function paletteFor(theme: ThemeName): Palette {
  return palettes[theme];
}

export const radius = {
  xs: 10,
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const type = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.4 },
  headline: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.2 },
  caption: { fontSize: 12, fontWeight: '600' as const },
  stat: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
};

export function elevation(theme: ThemeName, level: 1 | 2 | 3) {
  if (theme === 'dark') {
    return {
      shadowColor: '#000',
      shadowOpacity: level === 1 ? 0.4 : 0.55,
      shadowRadius: level === 1 ? 12 : level === 2 ? 22 : 34,
      shadowOffset: { width: 0, height: level * 4 },
      elevation: level * 3,
    };
  }
  return {
    shadowColor: '#0C1411',
    shadowOpacity: level === 1 ? 0.05 : level === 2 ? 0.08 : 0.12,
    shadowRadius: level === 1 ? 10 : level === 2 ? 18 : 28,
    shadowOffset: { width: 0, height: level * 3 },
    elevation: level * 2,
  };
}

export function glowShadow(color: string, strength = 0.35) {
  return {
    shadowColor: color,
    shadowOpacity: strength,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  };
}
