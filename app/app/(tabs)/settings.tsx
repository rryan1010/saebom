import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import type { EquipmentSetup, Experience } from '@shared/rules/index.ts';

import { confirmAction, useNow } from '@/lib/device';
import {
  cancelAllReminders,
  requestReminderPermission,
  sendTestReminder,
} from '@/lib/reminder-scheduler';
import {
  describeReminders,
  formatTimeOfDay,
  reminderTimes,
  WEEKDAY_ORDER,
  WEEKDAY_SHORT,
} from '@/lib/reminders';
import { EMPTY_STATE, REGION_LABELS, workoutDoneToday, type ReminderSettings } from '@/lib/workout';
import { updateWorkoutState, useWorkoutState } from '@/lib/workout-store';
import { Card, Muted } from '@/ui/Card';
import { Chips } from '@/ui/Chips';
import { Screen } from '@/ui/Screen';
import { Stepper } from '@/ui/Stepper';
import { TextButton } from '@/ui/TextButton';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const EXPERIENCE_LABELS: Record<Experience, string> = {
  new: 'Under 6 months',
  intermediate: '6 months – 2 years',
  experienced: '2+ years',
};

const EQUIPMENT_LABELS: Record<EquipmentSetup, string> = {
  full_gym: 'Full gym',
  dumbbells_only: 'Dumbbells + bench',
};

const WEEKDAY_CHIPS = WEEKDAY_ORDER.map((d) => ({ value: d as number, label: WEEKDAY_SHORT[d] }));

const nextLabel = (date: Date) =>
  `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${formatTimeOfDay(date.getHours(), date.getMinutes())}`;

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md }}>
      <Muted>{label}</Muted>
      <Text style={[TYPE.body, { color: colors.text, flexShrink: 1, textAlign: 'right' }]}>
        {value}
      </Text>
    </View>
  );
}

export default function Settings() {
  const { colors } = useTheme();
  const router = useRouter();
  const state = useWorkoutState();
  const now = useNow(60_000);
  const [notice, setNotice] = useState<string | null>(null);
  const { reminders, profile } = state;

  const setReminders = (patch: Partial<ReminderSettings>) =>
    updateWorkoutState((s) => ({ ...s, reminders: { ...s.reminders, ...patch } }));

  const toggleReminders = async (on: boolean) => {
    setNotice(null);
    if (!on) {
      setReminders({ enabled: false });
      return;
    }
    const permission = await requestReminderPermission();
    if (permission === 'denied') {
      setNotice(
        'Notifications are off for Saebom. Turn them on in the Settings app under Notifications, then try again.',
      );
      return;
    }
    setReminders({ enabled: true });
    if (permission === 'unavailable')
      setNotice('Reminders fire on the iPhone; this preview has none.');
  };

  const toggleDay = (day: number) =>
    setReminders({
      weekdays: reminders.weekdays.includes(day)
        ? reminders.weekdays.filter((d) => d !== day)
        : [...reminders.weekdays, day],
    });

  const testReminder = async () => {
    const sent = await sendTestReminder(5);
    setNotice(
      sent
        ? 'A test reminder arrives in 5 seconds. It shows even with the app open.'
        : 'Allow notifications for Saebom to send a test reminder.',
    );
  };

  const eraseEverything = async () => {
    const erase = await confirmAction(
      'Erase all data?',
      'Your plan, every logged workout and your reminder settings are deleted from this phone.',
      'Erase',
      true,
    );
    if (!erase) return;
    await cancelAllReminders();
    updateWorkoutState(() => EMPTY_STATE);
    router.replace('/onboarding');
  };

  const next = reminderTimes(reminders, now, workoutDoneToday(state, now))[0];
  const minuteOfDay = reminders.hour * 60 + reminders.minute;

  return (
    <Screen title="Settings">
      <Card title="Workout reminders">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          <View style={{ flex: 1 }}>
            <Muted small>
              A reminder on the days you pick, skipped once today’s workout is logged. It never
              shows weights or anything about your training.
            </Muted>
          </View>
          <Switch
            accessibilityLabel="Workout reminders"
            value={reminders.enabled}
            onValueChange={(on) => void toggleReminders(on)}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        {reminders.enabled ? (
          <View style={{ gap: SPACE.md, marginTop: SPACE.xs }}>
            <Chips
              compact
              options={WEEKDAY_CHIPS}
              isSelected={(d) => reminders.weekdays.includes(d)}
              onPress={toggleDay}
            />
            <Stepper
              label="Time"
              value={minuteOfDay}
              step={15}
              min={0}
              max={23 * 60 + 45}
              format={(m) => formatTimeOfDay(Math.floor(m / 60), m % 60)}
              onChange={(m) => setReminders({ hour: Math.floor(m / 60), minute: m % 60 })}
            />
            <Text style={[TYPE.body, { color: colors.text }]}>{describeReminders(reminders)}</Text>
            <Muted small>{next ? `Next: ${nextLabel(next)}` : 'Pick at least one day.'}</Muted>
          </View>
        ) : null}
        <TextButton label="Send a test reminder" onPress={() => void testReminder()} />
        {notice ? <Text style={[TYPE.caption, { color: colors.text }]}>{notice}</Text> : null}
      </Card>

      {profile ? (
        <Card title="Your profile">
          <Row label="Lifting for" value={EXPERIENCE_LABELS[profile.experience]} />
          <Row label="Goal" value={profile.goalIntensity === 'intense' ? 'Intense' : 'Steady'} />
          <Row label="Days a week" value={String(profile.daysPerWeek)} />
          <Row label="Equipment" value={EQUIPMENT_LABELS[profile.equipment]} />
          <Row
            label="Train around"
            value={
              profile.avoidAreas.length > 0
                ? profile.avoidAreas.map((a) => REGION_LABELS[a]).join(', ')
                : 'Nothing'
            }
          />
          <TextButton
            label="Change profile and rebuild plan"
            disabled={state.active !== null}
            onPress={() => router.push('/profile')}
          />
          {state.active ? (
            <Muted small>Finish or discard the workout in progress first.</Muted>
          ) : null}
        </Card>
      ) : null}

      <Card title="Your data">
        <Muted small>
          This proof of concept keeps everything on this phone: no account, no server, nothing sent
          anywhere. Deleting the app deletes it all.
        </Muted>
        <TextButton label="Erase all data" onPress={() => void eraseEverything()} />
      </Card>
    </Screen>
  );
}
