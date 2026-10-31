import { useState } from 'react';

import { PASSWORD_SESSION_KEY, sessionIdOf } from '@/lib/auth-state';
import { supabase } from '@/lib/supabase';
import { useAuthAction } from '@/lib/useAuthAction';
import { AuthScreen } from '@/ui/AuthScreen';
import { ErrorText } from '@/ui/ErrorText';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { TextField } from '@/ui/TextField';
import { UseDifferentAccountButton } from '@/ui/UseDifferentAccountButton';

const MIN_PASSWORD_LENGTH = 12;

async function savePassword(password: string) {
  const { data } = await supabase.auth.getSession();
  const sessionId = data.session === null ? null : sessionIdOf(data.session.access_token);
  return supabase.auth.updateUser({ password, data: { [PASSWORD_SESSION_KEY]: sessionId } });
}

export default function SetPassword() {
  const { busy, error, setError, run } = useAuthAction();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const canSubmit = password !== '' && confirmation !== '';

  async function submit() {
    if (!canSubmit) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError("The passwords don't match.");
      return;
    }
    await run(() => savePassword(password));
  }

  return (
    <AuthScreen
      title="Set a password"
      body={`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters. You will use it with your authenticator app to sign in.`}
    >
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules="minlength: 12;"
        returnKeyType="next"
      />
      <TextField
        label="Confirm password"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <ErrorText message={error} />
      <PrimaryButton
        label="Set password"
        onPress={() => void submit()}
        busy={busy}
        disabled={!canSubmit}
      />
      <UseDifferentAccountButton />
    </AuthScreen>
  );
}
