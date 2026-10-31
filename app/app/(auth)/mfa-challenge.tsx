import { useState } from 'react';
import { Text } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAuthAction } from '@/lib/useAuthAction';
import { AuthScreen } from '@/ui/AuthScreen';
import { ErrorText } from '@/ui/ErrorText';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { TextField } from '@/ui/TextField';
import { TYPE } from '@/ui/theme';
import { UseDifferentAccountButton } from '@/ui/UseDifferentAccountButton';
import { useTheme } from '@/ui/useTheme';

export default function MfaChallenge() {
  const { colors } = useTheme();
  const { busy, error, run } = useAuthAction();
  const [code, setCode] = useState('');

  const canSubmit = code.length === 6;

  function submit() {
    if (!canSubmit) return;
    void run(async () => {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) return factors;
      const factor = factors.data.totp[0];
      if (!factor) return { error: new Error('No verified authenticator factor') };
      return supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    });
  }

  return (
    <AuthScreen
      title="Enter your authenticator code"
      body="Open your authenticator app and enter the 6-digit code for Saebom."
    >
      <TextField
        label="6-digit code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        onSubmitEditing={submit}
      />
      <ErrorText message={error} />
      <PrimaryButton label="Verify" onPress={submit} busy={busy} disabled={!canSubmit} />
      <Text style={[TYPE.caption, { color: colors.textSecondary }]}>
        Lost your authenticator? Ask the person who invited you to reset it.
      </Text>
      <UseDifferentAccountButton />
    </AuthScreen>
  );
}
