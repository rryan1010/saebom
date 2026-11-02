import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  bestE1rms,
  exerciseFor,
  formatClock,
  formatLb,
  recordsIn,
  setsLogged,
  volumeLb,
  workoutName,
} from '@/lib/workout';
import { useWorkoutState } from '@/lib/workout-store';
import { Card, Muted, Pill } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const when = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function History() {
  const { colors } = useTheme();
  const state = useWorkoutState();
  const [open, setOpen] = useState<string | null>(null);
  const { plan } = state;
  if (!plan) return null;

  const sessions = [...state.sessions].reverse();
  const bests = bestE1rms(state.sessions).slice(0, 6);

  return (
    <Screen
      title="History"
      subtitle={
        sessions.length === 0
          ? 'Finished workouts show up here.'
          : `${sessions.length} workout${sessions.length === 1 ? '' : 's'} logged`
      }
    >
      {bests.length > 0 ? (
        <Card title="Best estimated max">
          {bests.map(({ exerciseSlug, e1rmLb }) => (
            <View
              key={exerciseSlug}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm }}
            >
              <Text style={[TYPE.body, { color: colors.text, flex: 1 }]}>
                {exerciseFor(exerciseSlug)?.name ?? exerciseSlug}
              </Text>
              <Text style={[TYPE.headline, { color: colors.text }]}>
                {formatLb(Math.round(e1rmLb))}
              </Text>
            </View>
          ))}
          <Muted small>Estimated from your sets of 12 reps or fewer.</Muted>
        </Card>
      ) : null}

      {sessions.map((session) => {
        const expanded = open === session.id;
        const records = recordsIn(state, session.id);
        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityHint={expanded ? 'Hides the sets' : 'Shows the sets'}
            onPress={() => setOpen(expanded ? null : session.id)}
          >
            <Card eyebrow={when(session.startedAt)} title={workoutName(plan, session.dayLabel)}>
              <Muted small>
                {formatClock(session.durationS)} · {setsLogged(session)} sets ·{' '}
                {formatLb(volumeLb(session))} lifted
              </Muted>
              <View style={{ flexDirection: 'row', gap: SPACE.sm, flexWrap: 'wrap' }}>
                {records > 0 ? (
                  <Pill label={`${records} rep record${records === 1 ? '' : 's'}`} />
                ) : null}
                {session.wentLighter ? <Pill label="Lighter day" /> : null}
              </View>
              {expanded
                ? session.exercises
                    .filter((log) => log.sets.length > 0)
                    .map((log) => (
                      <View key={log.exerciseSlug} style={{ gap: 2 }}>
                        <Text style={[TYPE.headline, { color: colors.text }]}>
                          {exerciseFor(log.exerciseSlug)?.name ?? log.exerciseSlug}
                          {log.stopped ? ' (stopped)' : ''}
                        </Text>
                        <Muted small>
                          {log.sets.map((s) => `${s.weightLb} × ${s.reps}`).join('   ')}
                        </Muted>
                      </View>
                    ))
                : null}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
