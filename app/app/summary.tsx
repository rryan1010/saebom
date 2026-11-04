import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  exerciseFor,
  formatClock,
  formatLb,
  lowerTargetsAfter,
  recordsIn,
  setsLogged,
  volumeLb,
  workoutName,
  type CompletedSession,
  type WorkoutState,
} from '@/lib/workout';
import { updateWorkoutState, useWorkoutState } from '@/lib/workout-store';
import { Card, Muted } from '@/ui/Card';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Ring } from '@/ui/Ring';
import { ScrollViewWithFooter } from '@/ui/ScrollViewWithFooter';
import { TextButton } from '@/ui/TextButton';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Feeling = 'comfortable' | 'hard' | 'hurt';

/** What happens to each exercise's weight next time, in plain words. */
function nextTimeLine(
  state: WorkoutState,
  session: CompletedSession,
  exerciseSlug: string,
): string {
  const change = session.changes.find((c) => c.exerciseSlug === exerciseSlug);
  const before = change?.beforeLb ?? null;
  const after = state.targets[exerciseSlug]?.targetWeightLb ?? null;
  const stopped = session.exercises.find((e) => e.exerciseSlug === exerciseSlug)?.stopped ?? false;
  if (after === null) return 'Calibrates next time';
  if (stopped) return `Stays at ${formatLb(after)} (stopped early)`;
  if (before === null) return `Calibrated: ${formatLb(after)} next time`;
  if (after > before) return `Up to ${formatLb(after)} (+${formatLb(after - before)})`;
  if (after < before) return `Down to ${formatLb(after)}`;
  return session.wentLighter
    ? `Stays at ${formatLb(after)} after a lighter day`
    : `Stays at ${formatLb(after)}: aim for one more rep`;
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={[TYPE.title, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
      <Muted small>{label}</Muted>
    </View>
  );
}

export default function Summary() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useWorkoutState();
  const [feeling, setFeeling] = useState<Feeling | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = state.sessions.find((s) => s.id === id);
  if (!session || !state.plan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: SPACE.lg }}>
        <PrimaryButton label="Back to Today" onPress={close} />
      </SafeAreaView>
    );
  }

  const records = recordsIn(state, session.id);
  const logged = session.exercises.filter((log) => log.sets.length > 0);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollViewWithFooter footer={<PrimaryButton label="Done" onPress={close} />}>
        <View style={{ alignItems: 'center', gap: SPACE.sm }}>
          <Ring size={140} progress={1} label="Workout done">
            <Text style={[TYPE.largeTitle, { color: colors.accent }]}>✓</Text>
          </Ring>
          <Text accessibilityRole="header" style={[TYPE.title, { color: colors.text }]}>
            {workoutName(state.plan, session.dayLabel)} done
          </Text>
        </View>

        <Card>
          <View style={{ flexDirection: 'row' }}>
            <Stat value={formatClock(session.durationS)} label="Time" />
            <Stat value={String(setsLogged(session))} label="Sets" />
            <Stat value={volumeLb(session).toLocaleString('en-US')} label="lb lifted" />
            <Stat value={String(records)} label={records === 1 ? 'Record' : 'Records'} />
          </View>
        </Card>

        <Card title="Next time">
          {logged.map((log) => (
            <View key={log.exerciseSlug} style={{ gap: 2 }}>
              <Text style={[TYPE.headline, { color: colors.text }]}>
                {exerciseFor(log.exerciseSlug)?.name ?? log.exerciseSlug}
              </Text>
              <Muted small>{nextTimeLine(state, session, log.exerciseSlug)}</Muted>
            </View>
          ))}
        </Card>

        <Card title="How did that feel?">
          <View style={{ gap: SPACE.sm }}>
            <PrimaryButton label="Comfortable" onPress={() => setFeeling('comfortable')} />
            <PrimaryButton label="Too hard" onPress={() => setFeeling('hard')} />
            <PrimaryButton label="Something hurt" onPress={() => setFeeling('hurt')} />
          </View>
          {feeling === 'comfortable' ? <Muted>Good. Your targets above stand.</Muted> : null}
          {feeling === 'hard' ? (
            session.loweredAfter ? (
              <Muted>Done: every target from this workout is one step lower.</Muted>
            ) : (
              <View style={{ gap: SPACE.xs }}>
                <Muted>
                  Want next time to be easier? This lowers each target above by one step.
                </Muted>
                <TextButton
                  label="Lower my targets"
                  onPress={() => updateWorkoutState((s) => lowerTargetsAfter(s, session.id))}
                />
              </View>
            )
          ) : null}
          {feeling === 'hurt' ? (
            <Muted>
              Sorry it hurt. Ease off anything that hurts and stop if it gets worse. If an area
              keeps bothering you, add it in Settings so your plan trains around it, and check with
              a doctor or physical therapist.
            </Muted>
          ) : null}
        </Card>
      </ScrollViewWithFooter>
    </SafeAreaView>
  );
}
