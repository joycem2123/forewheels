import { useColorScheme } from 'react-native';

/**
 * Fore Wheels: soap-bubble violet on a lavender-white ground. One accent colour across the app.
 * Light by default; follows the phone when it's set to dark.
 */
const light = {
  bg: '#FBFAFF',
  card: '#FFFFFF',
  text: '#1F1A3A',
  muted: '#6F6A8A',
  border: '#ECE8FA',
  /** The brand violet. Also the bubble card, which keeps this colour in both themes. */
  accent: '#6A4DF4',
  accentInk: '#5638E0',
  accentSoft: '#EFEBFF',
  bubble: '#DCD3FF',
  segment: '#EEEBF8',
  /** Dark surfaces: the total bar, selected day, date tiles. */
  dark: '#1F1A3A',
  darkMuted: '#BDB6E0',
  onAccent: '#FFFFFF',
  ok: '#1E9E6A',
  danger: '#C2372B',
  dangerSoft: '#FBF2F1',
  shadow: '#3C28A0',
};

const dark: Colors = {
  bg: '#14121F',
  card: '#1E1B2E',
  text: '#EEEBFA',
  muted: '#A29DBE',
  border: '#2C2843',
  accent: '#8B74FF',
  accentInk: '#B3A4FF',
  accentSoft: '#2A2450',
  bubble: '#3D3570',
  segment: '#1E1B2E',
  dark: '#2A2645',
  darkMuted: '#B3ACD6',
  onAccent: '#FFFFFF',
  ok: '#4CC793',
  danger: '#F0675B',
  dangerSoft: '#3A1F25',
  shadow: '#000000',
};

export type Colors = typeof light;

/** Fixed brand violet for the bubble card and Season Pass, the same in light and dark. */
export const BRAND = '#6A4DF4';
export const BRAND_INK = '#5638E0';

/** The app is always light (see app.json "userInterfaceStyle"), like Clutch Up. The dark palette is kept for later. */
export const ALWAYS_LIGHT = true;

export function useColors(): Colors {
  const scheme = useColorScheme();
  return !ALWAYS_LIGHT && scheme === 'dark' ? dark : light;
}

export const fonts = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 12, md: 16, lg: 20, xl: 28, blob: 34, pill: 999 } as const;
