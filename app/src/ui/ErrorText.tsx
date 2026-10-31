import { Text } from 'react-native';

import { TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export function ErrorText({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (message === null) return null;
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[TYPE.headline, { color: colors.text }]}
    >
      {message}
    </Text>
  );
}
