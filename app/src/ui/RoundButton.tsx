import { Pressable, Text } from 'react-native';

import { TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  label: string;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  /** Longer than the visible label when that helps VoiceOver. */
  accessibilityLabel?: string;
  /** Use 'outline' for the quieter choice next to a primary button. */
  variant?: 'filled' | 'outline';
};

export function RoundButton({
  label,
  onPress,
  size = 88,
  disabled = false,
  accessibilityLabel,
  variant = 'filled',
}: Props) {
  const { colors } = useTheme();
  const filled = variant === 'filled';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
        backgroundColor: filled ? colors.accent : 'transparent',
        borderWidth: filled ? 0 : 2,
        borderColor: colors.accent,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text
        numberOfLines={2}
        style={[
          size >= 100 ? TYPE.title : TYPE.headline,
          { color: filled ? colors.onAccent : colors.accent, textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
