import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = Omit<TextInputProps, 'style' | 'accessibilityLabel' | 'placeholderTextColor'> & {
  label: string;
};

export function TextField({ label, ...inputProps }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: SPACE.xs }}>
      <Text style={[TYPE.caption, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        style={[
          TYPE.body,
          {
            minHeight: 48,
            paddingHorizontal: SPACE.md,
            paddingVertical: SPACE.sm,
            borderRadius: 12,
            backgroundColor: colors.surface,
            color: colors.text,
          },
        ]}
      />
    </View>
  );
}
