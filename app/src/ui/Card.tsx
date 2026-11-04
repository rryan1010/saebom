import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  children: ReactNode;
  title?: string;
  /** Small capitals above the title, like "NEXT UP". */
  eyebrow?: string;
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, title, eyebrow, highlighted = false, style }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 24,
          padding: SPACE.md,
          gap: SPACE.sm,
          borderWidth: highlighted ? 2 : 0,
          borderColor: colors.accent,
        },
        style,
      ]}
    >
      {eyebrow ? (
        <Text style={[TYPE.caption, { color: colors.accent, letterSpacing: 1.2 }]}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      {title ? (
        <Text accessibilityRole="header" style={[TYPE.headline, { color: colors.text }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Body or caption text in the secondary color. */
export function Muted({ children, small = false }: { children: ReactNode; small?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text style={[small ? TYPE.caption : TYPE.body, { color: colors.textSecondary }]}>
      {children}
    </Text>
  );
}

export function Pill({
  label,
  tone = 'accent',
  centered = false,
}: {
  label: string;
  tone?: 'accent' | 'danger';
  centered?: boolean;
}) {
  const { colors } = useTheme();
  const color = tone === 'danger' ? colors.danger : colors.accent;
  return (
    <View
      style={{
        alignSelf: centered ? 'center' : 'flex-start',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: color,
        paddingHorizontal: SPACE.sm,
        paddingVertical: 2,
      }}
    >
      <Text style={[TYPE.caption, { color }]}>{label}</Text>
    </View>
  );
}
