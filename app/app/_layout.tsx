import { Stack } from 'expo-router';

import { useTheme } from '@/ui/useTheme';

export default function RootLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
