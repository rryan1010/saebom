import { ActivityIndicator, Pressable, Text } from 'react-native';

import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

export function PrimaryButton({ label, onPress, disabled = false, busy = false }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        borderRadius: 28,
        paddingHorizontal: SPACE.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent,
        opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text style={[TYPE.headline, { color: colors.onAccent }]}>{label}</Text>
      )}
    </Pressable>
  );
}
