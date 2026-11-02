import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { configureNotifications, syncReminders } from '@/lib/reminder-scheduler';
import {
  getWorkoutState,
  loadWorkoutState,
  useWorkoutState,
  useWorkoutStateLoaded,
} from '@/lib/workout-store';
import { useTheme } from '@/ui/useTheme';

void SplashScreen.preventAutoHideAsync();
configureNotifications();

// Phone-only POC: the plan, sessions and reminders live on the device, and sign-in is parked.
// The (auth) screens and the Supabase client stay in the tree for when the backend comes back.
export default function RootLayout() {
  const { colors } = useTheme();
  const loaded = useWorkoutStateLoaded();
  const state = useWorkoutState();

  useEffect(() => {
    void loadWorkoutState();
  }, []);

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  // Reminders depend on the settings, on whether today's workout is recorded, and on the date, so
  // reschedule when any of those change and whenever the app comes back to the foreground (§9).
  const reminderInputs = loaded
    ? JSON.stringify([state.reminders, state.sessions.length, state.active?.id ?? null])
    : null;
  useEffect(() => {
    if (reminderInputs !== null) void syncReminders(getWorkoutState);
  }, [reminderInputs]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void syncReminders(getWorkoutState);
    });
    return () => subscription.remove();
  }, []);

  if (!loaded) return null;
  const hasPlan = state.profile !== null && state.plan !== null;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Protected guard={hasPlan} redirectTo="/onboarding">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="session"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen
          name="summary"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!hasPlan} redirectTo="/">
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={false} redirectTo="/">
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/invite" />
        <Stack.Screen name="(auth)/mfa-challenge" />
        <Stack.Screen name="(auth)/set-password" />
        <Stack.Screen name="(auth)/mfa-enroll" />
      </Stack.Protected>
    </Stack>
  );
}
