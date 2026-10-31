import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  title: string;
  body?: string;
  eyebrow?: ReactNode;
  children: ReactNode;
};

export function AuthScreen({ title, body, eyebrow, children }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, padding: SPACE.lg, gap: SPACE.md }}
        >
          {eyebrow}
          <Text accessibilityRole="header" style={[TYPE.title, { color: colors.text }]}>
            {title}
          </Text>
          {body ? <Text style={[TYPE.body, { color: colors.textSecondary }]}>{body}</Text> : null}
          <View style={{ gap: SPACE.md }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
