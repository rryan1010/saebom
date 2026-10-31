import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuthAction } from '@/lib/useAuthAction';
import { AuthScreen } from '@/ui/AuthScreen';
import { ErrorText } from '@/ui/ErrorText';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { TextButton } from '@/ui/TextButton';
import { TextField } from '@/ui/TextField';
import { TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function SignIn() {
  const router = useRouter();
  const { colors } = useTheme();
  const { busy, error, run } = useAuthAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim() !== '' && password !== '';

  function submit() {
    if (!canSubmit) return;
    void run(() =>
      supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }),
    );
  }

  return (
    <AuthScreen
      title="Sign in"
      eyebrow={
        <Text
          accessibilityLabel="Saebom"
          style={[TYPE.largeTitle, { fontSize: 56, lineHeight: 64, color: colors.accent }]}
        >
          새봄
        </Text>
      }
    >
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorText message={error} />
      <PrimaryButton label="Sign in" onPress={submit} busy={busy} disabled={!canSubmit} />
      <TextButton
        label="I have an invite code"
        onPress={() => router.push('/invite')}
        disabled={busy}
      />
    </AuthScreen>
  );
}
