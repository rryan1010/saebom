export type Scheme = 'dark' | 'light';
export type ColorRole = 'background' | 'surface' | 'text' | 'textSecondary' | 'accent' | 'onAccent';

// accent and onAccent are defaults until the owner answers #7
export const COLORS = {
  dark: {
    background: '#0B0D0C',
    surface: '#1A1D1B',
    text: '#F5F7F5',
    textSecondary: '#A3ABA6',
    accent: '#3DDC84',
    onAccent: '#06140C',
  },
  light: {
    background: '#FFFFFF',
    surface: '#F1F3F1',
    text: '#0B0D0C',
    textSecondary: '#4F5752',
    accent: '#0F7A3D',
    onAccent: '#FFFFFF',
  },
} as const satisfies Record<Scheme, Record<ColorRole, string>>;

export const TYPE = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '900' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
} as const;

export const SPACE = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const MOTION = { durationMs: 250 } as const;
