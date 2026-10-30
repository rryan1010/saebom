import { useColorScheme } from 'react-native';

import { COLORS, type Scheme } from '@/ui/theme';

export function useTheme() {
  const scheme: Scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return { scheme, colors: COLORS[scheme] };
}
