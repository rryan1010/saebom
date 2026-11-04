import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { SPACE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Scrolling content with a bar pinned under it, for screens without a title. */
export function ScrollViewWithFooter({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: SPACE.md, paddingBottom: SPACE.xl, gap: SPACE.md }}
      >
        {children}
      </ScrollView>
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
    </>
  );
}
