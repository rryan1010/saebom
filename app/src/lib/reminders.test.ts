import { describe, expect, it } from 'vitest';

import {
  describeReminders,
  formatTimeOfDay,
  REMINDER_BODY,
  REMINDER_WINDOW_DAYS,
  reminderTimes,
} from './reminders.ts';
import type { ReminderSettings } from './workout.ts';

// Monday, Nov 2, 2026, 9:00 in the machine's local time.
const MONDAY_9AM = new Date(2026, 10, 2, 9, 0);

const settings = (overrides: Partial<ReminderSettings> = {}): ReminderSettings => ({
  enabled: true,
  weekdays: [1, 3, 5],
  hour: 18,
  minute: 0,
  ...overrides,
});

describe('reminderTimes', () => {
  it('schedules nothing while reminders are off', () => {
    expect(reminderTimes(settings({ enabled: false }), MONDAY_9AM, false)).toEqual([]);
  });

  it('fires only on the chosen weekdays, at the chosen time', () => {
    const times = reminderTimes(settings(), MONDAY_9AM, false);
    expect(times.length).toBe(12); // Mon, Wed, Fri for four weeks
    for (const t of times) {
      expect([1, 3, 5]).toContain(t.getDay());
      expect([t.getHours(), t.getMinutes()]).toEqual([18, 0]);
    }
  });

  it('starts with today when the time is still ahead and nothing is recorded', () => {
    const [first] = reminderTimes(settings(), MONDAY_9AM, false);
    expect(first?.getDate()).toBe(2);
  });

  it("skips today once today's workout is recorded", () => {
    const [first] = reminderTimes(settings(), MONDAY_9AM, true);
    expect(first?.getDate()).toBe(4); // Wednesday
  });

  it("skips today once today's time has passed", () => {
    const [first] = reminderTimes(settings(), new Date(2026, 10, 2, 18, 30), false);
    expect(first?.getDate()).toBe(4);
  });

  it('stays inside the four-week window, under the iOS limit of about 64', () => {
    const times = reminderTimes(settings({ weekdays: [0, 1, 2, 3, 4, 5, 6] }), MONDAY_9AM, false);
    expect(times.length).toBe(REMINDER_WINDOW_DAYS);
    const last = times[times.length - 1];
    expect(last && last.getTime() - MONDAY_9AM.getTime()).toBeLessThan(28 * 24 * 3600 * 1000);
  });

  it('carries no health data in its text (D9)', () => {
    expect(REMINDER_BODY).not.toMatch(/\d/);
  });
});

describe('describing reminders', () => {
  it.each([
    [0, 0, '12:00 AM'],
    [9, 5, '9:05 AM'],
    [12, 0, '12:00 PM'],
    [18, 30, '6:30 PM'],
  ])('formats %i:%i as %s', (h, m, text) => {
    expect(formatTimeOfDay(h, m)).toBe(text);
  });

  it('lists the days Monday first', () => {
    expect(describeReminders(settings({ weekdays: [0, 5, 1] }))).toBe('Mon, Fri, Sun at 6:00 PM');
    expect(describeReminders(settings({ weekdays: [] }))).toBe('No days picked');
    expect(describeReminders(settings({ weekdays: [0, 1, 2, 3, 4, 5, 6] }))).toBe(
      'Every day at 6:00 PM',
    );
  });
});
