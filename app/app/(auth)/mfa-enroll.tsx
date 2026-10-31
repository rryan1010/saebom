import * as Clipboard from 'expo-clipboard';
import { Linking, Text } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { authErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { useAuthAction } from '@/lib/useAuthAction';
import { AuthScreen } from '@/ui/AuthScreen';
import { ErrorText } from '@/ui/ErrorText';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { TextButton } from '@/ui/TextButton';
import { TextField } from '@/ui/TextField';
import { TYPE } from '@/ui/theme';
import { UseDifferentAccountButton } from '@/ui/UseDifferentAccountButton';
import { useTheme } from '@/ui/useTheme';

type Enrollment = { factorId: string; secret: string; uri: string };

async function startEnrollment(): Promise<Enrollment> {
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) throw factors.error;
  for (const factor of factors.data.all) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (removed.error) throw removed.error;
    }
  }
  const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (enrolled.error) throw enrolled.error;
  const { id, totp } = enrolled.data;
  return { factorId: id, secret: totp.secret, uri: totp.uri };
}

function groupsOfFour(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}

export default function MfaEnroll() {
  const { colors } = useTheme();
  const { busy, error, run } = useAuthAction();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const started = useRef(false);

  function begin() {
    setStartError(null);
    startEnrollment().then(setEnrollment, (thrown: unknown) => {
      setStartError(authErrorMessage(thrown));
      started.current = false;
    });
  }

  useEffect(() => {
    // Strict Mode runs effects twice in development; enrolling twice would orphan a factor.
    if (started.current) return;
    started.current = true;
    begin();
  }, []);

  function openAuthenticator(uri: string) {
    setNotice(null);
    Linking.openURL(uri).catch(() => {
      setNotice('No authenticator app opened. Copy the key and paste it into your app instead.');
    });
  }

  async function copyKey(secret: string) {
    await Clipboard.setStringAsync(secret);
    setCopied(true);
  }

  function verify(factorId: string) {
    if (code.length !== 6) return;
    void run(() => supabase.auth.mfa.challengeAndVerify({ factorId, code }));
  }

  if (enrollment === null) {
    return (
      <AuthScreen
        title="Set up your authenticator"
        body="An authenticator app makes a new 6-digit code every 30 seconds. You will need it each time you sign in."
      >
        {startError === null ? (
          <Text style={[TYPE.body, { color: colors.textSecondary }]}>Getting your key…</Text>
        ) : (
          <>
            <ErrorText message={startError} />
            <PrimaryButton label="Try again" onPress={begin} />
          </>
        )}
        <UseDifferentAccountButton />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Set up your authenticator"
      body="An authenticator app makes a new 6-digit code every 30 seconds. You will need it each time you sign in."
    >
      <PrimaryButton
        label="Open authenticator app"
        onPress={() => openAuthenticator(enrollment.uri)}
      />
      {notice ? <ErrorText message={notice} /> : null}
      <Text style={[TYPE.caption, { color: colors.textSecondary }]}>
        Or enter this key in your authenticator app:
      </Text>
      <Text
        selectable
        accessibilityLabel={`Authenticator key ${enrollment.secret.split('').join(' ')}`}
        style={[TYPE.headline, { color: colors.text, fontFamily: 'Menlo' }]}
      >
        {groupsOfFour(enrollment.secret)}
      </Text>
      <TextButton
        label={copied ? 'Copied' : 'Copy key'}
        onPress={() => void copyKey(enrollment.secret)}
      />
      <TextField
        label="6-digit code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        onSubmitEditing={() => verify(enrollment.factorId)}
      />
      <ErrorText message={error} />
      <PrimaryButton
        label="Verify"
        onPress={() => verify(enrollment.factorId)}
        busy={busy}
        disabled={code.length !== 6}
      />
      <UseDifferentAccountButton />
    </AuthScreen>
  );
}
