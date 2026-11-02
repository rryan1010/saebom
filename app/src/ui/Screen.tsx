import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned below the scrolling content, e.g. the session's Finish button. */
  footer?: ReactNode;
  /** Tab screens leave the bottom edge to the tab bar. */
  edges?: readonly Edge[];
  header?: ReactNode;
};

export function Screen({ title, subtitle, children, footer, header, edges = ['top'] }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: SPACE.md, paddingBottom: SPACE.xl, gap: SPACE.md }}
      >
        {header}
        <View style={{ gap: SPACE.xs }}>
          <Text accessibilityRole="header" style={[TYPE.largeTitle, { color: colors.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[TYPE.body, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: SPACE.md,
            paddingVertical: SPACE.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
