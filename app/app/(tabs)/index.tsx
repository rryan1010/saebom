import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { tapFeedback, useNow } from '@/lib/device';
import { describeReminders } from '@/lib/reminders';
import {
  elapsedS,
  exerciseFor,
  formatClock,
  formatLb,
  isCalibrating,
  itemsFor,
  nextWorkoutLabel,
  sessionsThisWeek,
  startSession,
  workoutDoneToday,
  workoutName,
} from '@/lib/workout';
import { newId, updateWorkoutState, useWorkoutState } from '@/lib/workout-store';
import { Card, Muted, Pill } from '@/ui/Card';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Ring } from '@/ui/Ring';
import { RoundButton } from '@/ui/RoundButton';
import { Screen } from '@/ui/Screen';
import { TextButton } from '@/ui/TextButton';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Step = 'ready' | 'check-in' | 'go-lighter';
type Feeling = 'good' | 'off' | 'sore';

const dateLabel = (now: Date) =>
  now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export default function Today() {
  const { colors } = useTheme();
  const router = useRouter();
  const state = useWorkoutState();
  const now = useNow(1000);
  const [step, setStep] = useState<Step>('ready');
  const [feeling, setFeeling] = useState<Feeling>('good');

  const { plan, active, profile } = state;
  if (!plan || !profile) return null;

  if (active) {
    return (
      <Screen title="Today" subtitle={dateLabel(now)}>
        <Card eyebrow="In progress" title={workoutName(plan, active.dayLabel)} highlighted>
          <Text
            style={[TYPE.largeTitle, { color: colors.text, fontVariant: ['tabular-nums'] }]}
            accessibilityLabel={`Elapsed ${formatClock(elapsedS(active.startedAt, now))}`}
          >
            {formatClock(elapsedS(active.startedAt, now))}
          </Text>
          <PrimaryButton label="Resume workout" onPress={() => router.push('/session')} />
        </Card>
      </Screen>
    );
  }

  const label = nextWorkoutLabel(state);
  const items = label ? itemsFor(plan, label) : [];
  const doneToday = workoutDoneToday(state, now);
  const weekDone = sessionsThisWeek(state.sessions, now);
  const calibrating = items.some((item) => isCalibrating(state.targets[item.exerciseSlug]));

  const begin = (wentLighter: boolean) => {
    tapFeedback();
    updateWorkoutState((s) => startSession(s, { id: newId(), now: new Date(), wentLighter }));
    setStep('ready');
    router.push('/session');
  };

  const answer = (how: Feeling) => {
    setFeeling(how);
    if (how === 'good') begin(false);
    else setStep('go-lighter');
  };

  return (
    <Screen title="Today" subtitle={dateLabel(now)}>
      {doneToday ? (
        <Card>
          <Text style={[TYPE.headline, { color: colors.accent }]}>Today’s workout is done.</Text>
          <Muted>Rest up. Your next workout is below whenever you’re ready.</Muted>
        </Card>
      ) : null}

      {label ? (
        <Card eyebrow="Next up" title={workoutName(plan, label)}>
          <Muted small>
            {items.length} exercises · {items.reduce((n, i) => n + i.sets, 0)} sets
          </Muted>
          <View style={{ gap: SPACE.sm, marginTop: SPACE.xs }}>
            {items.map((item) => {
              const exercise = exerciseFor(item.exerciseSlug);
              const target = state.targets[item.exerciseSlug]?.targetWeightLb ?? null;
              return (
                <View
                  key={`${item.dayLabel}-${item.position}`}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm }}
                >
                  <Text style={[TYPE.body, { color: colors.text, flex: 1 }]}>
                    {exercise?.name ?? item.exerciseSlug}
                  </Text>
                  <Text style={[TYPE.body, { color: colors.textSecondary }]}>
                    {item.sets} × {item.repMin}–{item.repMax}
                    {target === null ? '' : ` · ${formatLb(target)}`}
                  </Text>
                </View>
              );
            })}
          </View>
          {calibrating ? (
            <View style={{ marginTop: SPACE.xs }}>
              <Pill label="Calibration pass" />
              <Muted small>
                First time through, pick a light weight you could lift for the whole rep range with
                a few reps to spare. Saebom sets your targets from those sets, so nobody tests a
                max.
              </Muted>
            </View>
          ) : null}
        </Card>
      ) : null}

      {label && step === 'ready' ? (
        <View style={{ alignItems: 'center', paddingVertical: SPACE.sm }}>
          <RoundButton
            label="Start"
            size={132}
            accessibilityLabel={`Start ${workoutName(plan, label)}`}
            onPress={() => setStep('check-in')}
          />
        </View>
      ) : null}

      {step === 'check-in' ? (
        <Card title="How are you feeling today?">
          <View style={{ gap: SPACE.sm }}>
            <PrimaryButton label="Good" onPress={() => answer('good')} />
            <PrimaryButton label="A bit off" onPress={() => answer('off')} />
            <PrimaryButton label="Sore or hurting" onPress={() => answer('sore')} />
            <TextButton label="Not now" onPress={() => setStep('ready')} />
          </View>
        </Card>
      ) : null}

      {step === 'go-lighter' ? (
        <Card title="Go lighter today?">
          <Muted>
            Every target drops one step for this workout only. Your plan stays where it is, so an
            easy day never counts against you.
          </Muted>
          {feeling === 'sore' ? (
            <Muted>
              If something hurts, skip that exercise with “Pain? Stop”. If it keeps bothering you,
              add it as an area to train around in Settings.
            </Muted>
          ) : null}
          <View style={{ gap: SPACE.sm, marginTop: SPACE.xs }}>
            <PrimaryButton label="Go lighter today" onPress={() => begin(true)} />
            <TextButton label="Start as planned" onPress={() => begin(false)} />
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
          <Ring
            size={72}
            progress={weekDone / plan.daysPerWeek}
            label={`${weekDone} of ${plan.daysPerWeek} workouts this week`}
          >
            <Text style={[TYPE.headline, { color: colors.text }]}>
              {weekDone}/{plan.daysPerWeek}
            </Text>
          </Ring>
          <View style={{ flex: 1, gap: SPACE.xs }}>
            <Text style={[TYPE.headline, { color: colors.text }]}>This week</Text>
            <Muted small>
              {state.reminders.enabled
                ? `Reminders: ${describeReminders(state.reminders)}`
                : 'Reminders are off.'}
            </Muted>
          </View>
        </View>
        {!state.reminders.enabled ? (
          <TextButton label="Turn on reminders" onPress={() => router.push('/settings')} />
        ) : null}
      </Card>
    </Screen>
  );
}
