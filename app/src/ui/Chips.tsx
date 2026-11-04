import { Pressable, Text, View } from 'react-native';

import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export type ChipOption<T> = { value: T; label: string };

type Props<T> = {
  options: readonly ChipOption<T>[];
  isSelected: (value: T) => boolean;
  onPress: (value: T) => void;
  /** Square-ish chips for short labels like weekdays or day counts. */
  compact?: boolean;
};

export function Chips<T extends string | number>({
  options,
  isSelected,
  onPress,
  compact = false,
}: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
      {options.map((option) => {
        const selected = isSelected(option.value);
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onPress(option.value)}
            style={({ pressed }) => ({
              minHeight: 44,
              minWidth: compact ? 44 : undefined,
              paddingHorizontal: compact ? SPACE.sm : SPACE.md,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.accent : colors.surface,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.border,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text style={[TYPE.headline, { color: selected ? colors.onAccent : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
