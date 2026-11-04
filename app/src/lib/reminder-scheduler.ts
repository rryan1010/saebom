import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { REMINDER_BODY, REMINDER_TITLE, reminderTimes } from './reminders.ts';
import { workoutDoneToday, type WorkoutState } from './workout.ts';

// Local notifications only (D20): no push server, no device token. The web build used for
// screenshots has no scheduler, so every call is a no-op there.
const supported = Platform.OS !== 'web';

export function configureNotifications(): void {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type ReminderPermission = 'granted' | 'denied' | 'unavailable';

/** Asks only when the lifter turns reminders on (§9); the app works fully without it. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (!supported) return 'unavailable';
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted ? 'granted' : 'denied';
}

let syncing: Promise<number> = Promise.resolve(0);

/**
 * Cancels this app's reminders and schedules the next four weeks again, skipping today once its
 * workout is recorded. Calls run one after another so two quick changes can't double-schedule.
 */
export function syncReminders(read: () => WorkoutState): Promise<number> {
  syncing = syncing.then(() => schedule(read())).catch(() => 0);
  return syncing;
}

async function schedule(state: WorkoutState): Promise<number> {
  if (!supported) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.reminders.enabled) return 0;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;
  const now = new Date();
  const times = reminderTimes(state.reminders, now, workoutDoneToday(state, now));
  for (const date of times) {
    await Notifications.scheduleNotificationAsync({
      content: { title: REMINDER_TITLE, body: REMINDER_BODY },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
  return times.length;
}

/** For trying reminders on the phone: one notification a few seconds from now. */
export async function sendTestReminder(seconds = 5): Promise<boolean> {
  if ((await requestReminderPermission()) !== 'granted') return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: REMINDER_TITLE, body: REMINDER_BODY },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
  return true;
}

export function cancelAllReminders(): Promise<void> {
  return supported ? Notifications.cancelAllScheduledNotificationsAsync() : Promise.resolve();
}
