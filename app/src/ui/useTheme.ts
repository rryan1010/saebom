import { useColorScheme } from 'react-native';

import { COLORS, schemeFor } from '@/ui/theme';

export function useTheme() {
  const scheme = schemeFor(useColorScheme());
  return { scheme, colors: COLORS[scheme] };
}
