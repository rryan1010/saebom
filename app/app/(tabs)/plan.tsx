import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import {
  dayLabels,
  exerciseFor,
  formatLb,
  itemsFor,
  muscleLine,
  nextWorkoutLabel,
  REGION_LABELS,
  SPLIT_NAMES,
  workoutName,
} from '@/lib/workout';
import { useWorkoutState } from '@/lib/workout-store';
import { Card, Muted, Pill } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { TextButton } from '@/ui/TextButton';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function PlanScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const state = useWorkoutState();
  const { plan, profile } = state;
  if (!plan || !profile) return null;

  const next = nextWorkoutLabel(state);
  const capped = profile.daysPerWeek > plan.daysPerWeek;

  return (
    <Screen
      title="Your plan"
      subtitle={`${SPLIT_NAMES[plan.split]} · ${plan.daysPerWeek} days a week · workouts rotate in order`}
    >
      {capped ? (
        <Muted small>
          You can train {profile.daysPerWeek} days, and the rules start this profile at{' '}
          {plan.daysPerWeek}.
        </Muted>
      ) : null}
      {profile.avoidAreas.length > 0 ? (
        <Muted small>
          Training around: {profile.avoidAreas.map((a) => REGION_LABELS[a]).join(', ')}. No exercise
          here loads those areas.
        </Muted>
      ) : null}

      {dayLabels(plan).map((label) => (
        <Card
          key={label}
          eyebrow={label === next ? 'Next up' : `Workout ${label}`}
          title={workoutName(plan, label)}
          highlighted={label === next}
        >
          {itemsFor(plan, label).map((item) => {
            const exercise = exerciseFor(item.exerciseSlug);
            if (!exercise) return null;
            const target = state.targets[item.exerciseSlug]?.targetWeightLb ?? null;
            return (
              <View
                key={item.position}
                style={{
                  gap: 2,
                  paddingVertical: SPACE.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                  <Text style={[TYPE.headline, { color: colors.text, flex: 1 }]}>
                    {exercise.name}
                  </Text>
                  {item.isLight ? <Pill label="Light" /> : null}
                </View>
                <Muted small>{muscleLine(exercise)}</Muted>
                <Text style={[TYPE.body, { color: colors.text }]}>
                  {item.sets} sets × {item.repMin}–{item.repMax} reps · {item.rir}+ in reserve ·{' '}
                  {target === null ? 'calibrate first' : formatLb(target)}
                </Text>
                {exercise.cues.map((cue) => (
                  <Muted key={cue} small>
                    • {cue}
                  </Muted>
                ))}
              </View>
            );
          })}
        </Card>
      ))}

      <Muted small>
        Built by fixed rules, never AI. Weights move up one step when every set reaches the top of
        the range, and drop about 10% after two sessions below it.
      </Muted>
      <TextButton
        label="Change profile and rebuild plan"
        disabled={state.active !== null}
        onPress={() => router.push('/profile')}
      />
    </Screen>
  );
}
