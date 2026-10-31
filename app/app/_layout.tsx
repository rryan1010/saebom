import { Stack, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import type { AuthStatus } from '@/lib/auth-state';
import { AuthProvider, useAuthStatus } from '@/lib/AuthProvider';
import { useTheme } from '@/ui/useTheme';

void SplashScreen.preventAutoHideAsync();

// Without an explicit target, a guarded route falls back to a screen the router picks, which on a
// cold start was the invite screen rather than sign-in.
const LANDING: Record<Exclude<AuthStatus, 'loading'>, Href> = {
  signedOut: '/sign-in',
  needsChallenge: '/mfa-challenge',
  needsPassword: '/set-password',
  needsEnrollment: '/mfa-enroll',
  signedIn: '/',
};

function Navigator() {
  const { colors } = useTheme();
  const status = useAuthStatus();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;
  const landing = LANDING[status];

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Protected guard={status === 'signedOut'} redirectTo={landing}>
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/invite" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsChallenge'} redirectTo={landing}>
        <Stack.Screen name="(auth)/mfa-challenge" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsPassword'} redirectTo={landing}>
        <Stack.Screen name="(auth)/set-password" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsEnrollment'} redirectTo={landing}>
        <Stack.Screen name="(auth)/mfa-enroll" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'} redirectTo={landing}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Navigator />
    </AuthProvider>
  );
}
