import { Text, View } from 'react-native';

import { TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function Index() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}
    >
      <Text accessibilityRole="header" style={[TYPE.largeTitle, { color: colors.text }]}>
        Saebom
      </Text>
    </View>
  );
}
