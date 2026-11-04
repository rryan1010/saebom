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
// The sign-in screens wait unchanged in src/parked/(auth): Expo Router loads every file under
// app/ at startup in development, and they would need Supabase settings the POC doesn't use.
// To bring them back, move that folder back to app/(auth) and restore the guard that sends
// signed-out users to /sign-in.
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
    </Stack>
  );
}
