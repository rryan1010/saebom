import type { ReminderSettings } from './workout.ts';

/** iOS keeps only about the 64 soonest local notifications; four weeks stays far below that (§9). */
export const REMINDER_WINDOW_DAYS = 28;

/** Never weights, reps, records or injured areas: lock screens are visible to others (D9). */
export const REMINDER_TITLE = 'Saebom';
export const REMINDER_BODY = "Time for today's workout";

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** Monday first, as the progress week runs (D66). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * The local times the next reminders should fire: each chosen weekday at the chosen time, over the
 * next four weeks. Today is skipped once its workout is recorded or its time has passed.
 */
export function reminderTimes(
  settings: ReminderSettings,
  now: Date,
  doneToday: boolean,
  days: number = REMINDER_WINDOW_DAYS,
): Date[] {
  if (!settings.enabled) return [];
  const times: Date[] = [];
  for (let offset = 0; offset < days; offset++) {
    // The local-date constructor keeps the wall-clock time across daylight-saving changes.
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      settings.hour,
      settings.minute,
    );
    if (!settings.weekdays.includes(at.getDay())) continue;
    if (at.getTime() <= now.getTime()) continue;
    if (offset === 0 && doneToday) continue;
    times.push(at);
  }
  return times;
}

/** 18:00 → "6:00 PM". */
export function formatTimeOfDay(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** "Mon, Wed, Fri at 6:00 PM", or "No days picked". */
export function describeReminders(settings: ReminderSettings): string {
  const days = WEEKDAY_ORDER.filter((d) => settings.weekdays.includes(d)).map(
    (d) => WEEKDAY_SHORT[d],
  );
  if (days.length === 0) return 'No days picked';
  const when = days.length === 7 ? 'Every day' : days.join(', ');
  return `${when} at ${formatTimeOfDay(settings.hour, settings.minute)}`;
}
