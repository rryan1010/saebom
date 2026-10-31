import { useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthAction } from '@/lib/useAuthAction';
import { AuthScreen } from '@/ui/AuthScreen';
import { ErrorText } from '@/ui/ErrorText';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { TextField } from '@/ui/TextField';

export default function Invite() {
  const { busy, error, run } = useAuthAction();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const canSubmit = email.trim() !== '' && code.trim() !== '';

  function submit() {
    if (!canSubmit) return;
    void run(() =>
      supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'email',
      }),
    );
  }

  return (
    <AuthScreen
      title="Enter your code"
      body="Use the email address you were invited with and the one-time code you were sent. The same code works after a password reset."
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
        label="Invite code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        onSubmitEditing={submit}
      />
      <ErrorText message={error} />
      <PrimaryButton label="Continue" onPress={submit} busy={busy} disabled={!canSubmit} />
    </AuthScreen>
  );
}
