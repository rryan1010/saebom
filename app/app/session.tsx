import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmAction, successFeedback, tapFeedback, useNow } from '@/lib/device';
import {
  discardSession,
  elapsedS,
  exerciseFor,
  finishSession,
  formatClock,
  itemFor,
  logSet,
  rateSet,
  removeLastSet,
  repRecords,
  sessionProgress,
  sessionTargetLb,
  setsLogged,
  setStopped,
  suggestedReps,
  suggestedWeightLb,
  workoutName,
} from '@/lib/workout';
import { updateWorkoutState, useWorkoutState } from '@/lib/workout-store';
import { Pill } from '@/ui/Card';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { Ring } from '@/ui/Ring';
import { ScrollViewWithFooter } from '@/ui/ScrollViewWithFooter';
import { TextButton } from '@/ui/TextButton';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const KEEP_AWAKE_TAG = 'saebom-session';

/** The screen stays on during a workout, so the timer is there between sets. */
function useKeepScreenOn(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, []);
}

export default function Session() {
  const { colors } = useTheme();
  const router = useRouter();
  const state = useWorkoutState();
  const now = useNow(1000);
  const [chosen, setChosen] = useState<number | null>(null);
  useKeepScreenOn();

  const { active, plan } = state;
  if (!active || !plan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: SPACE.lg }}>
        <Text style={[TYPE.title, { color: colors.text }]}>No workout in progress</Text>
        <PrimaryButton label="Back to Today" onPress={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  const records = repRecords(state.sessions);
  const progress = sessionProgress(plan, active);
  const logged = setsLogged(active);
  const clock = formatClock(elapsedS(active.startedAt, now));
  // The open card: the one the lifter tapped, or else the first exercise with sets left.
  const firstOpen = active.exercises.findIndex(
    (log) =>
      !log.stopped &&
      log.sets.length < (itemFor(plan, active.dayLabel, log.exerciseSlug)?.sets ?? 0),
  );
  const openIndex = chosen ?? (firstOpen >= 0 ? firstOpen : active.exercises.length - 1);

  const finish = async () => {
    if (logged === 0) return;
    if (progress.done < progress.planned) {
      const ok = await confirmAction(
        'Finish workout?',
        `You’ve logged ${progress.done} of ${progress.planned} sets. Exercises you skipped keep their targets.`,
        'Finish',
      );
      if (!ok) return;
    }
    const id = active.id;
    successFeedback();
    updateWorkoutState((s) => finishSession(s, new Date()));
    router.replace({ pathname: '/summary', params: { id } });
  };

  const discard = async () => {
    const ok = await confirmAction(
      'Discard this workout?',
      'Nothing from it is saved, and it won’t count as today’s workout.',
      'Discard',
      true,
    );
    if (!ok) return;
    updateWorkoutState(discardSession);
    router.back();
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollViewWithFooter
        footer={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
            <TextButton label="Discard" tone="danger" onPress={() => void discard()} />
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={logged === 0 ? 'Log a set to finish' : 'Finish workout'}
                disabled={logged === 0}
                onPress={() => void finish()}
              />
            </View>
          </View>
        }
      >
        <View style={{ alignItems: 'center', gap: SPACE.sm }}>
          <Text accessibilityRole="header" style={[TYPE.title, { color: colors.text }]}>
            {workoutName(plan, active.dayLabel)}
          </Text>
          {active.wentLighter ? <Pill label="Lighter today" centered /> : null}
          <Ring
            size={216}
            progress={progress.planned > 0 ? progress.done / progress.planned : 0}
            label={`Elapsed ${clock}. ${progress.done} of ${progress.planned} sets done`}
          >
            <Text
              style={[
                TYPE.largeTitle,
                { color: colors.text, fontSize: 48, lineHeight: 56, fontVariant: ['tabular-nums'] },
              ]}
            >
              {clock}
            </Text>
            <Text style={[TYPE.caption, { color: colors.textSecondary }]}>
              {progress.done} of {progress.planned} sets
            </Text>
          </Ring>
        </View>

        {active.exercises.map((log, index) => {
          const exercise = exerciseFor(log.exerciseSlug);
          const item = itemFor(plan, active.dayLabel, log.exerciseSlug);
          if (!exercise || !item) return null;
          const nextIndex = active.exercises.findIndex(
            (other, i) => i > index && !other.stopped && other.sets.length === 0,
          );
          return (
            <ExerciseCard
              key={`${active.id}-${index}`}
              position={index + 1}
              log={log}
              item={item}
              exercise={exercise}
              targetLb={sessionTargetLb(
                state.targets[log.exerciseSlug],
                exercise,
                active.wentLighter,
              )}
              wentLighter={active.wentLighter}
              records={records}
              open={index === openIndex}
              startWeightLb={suggestedWeightLb(state, index) ?? exercise.minLoadLb}
              startReps={suggestedReps(state, index) ?? item.repMax}
              onOpen={() => setChosen(index)}
              onLog={(weightLb, reps) => {
                tapFeedback();
                updateWorkoutState((s) => logSet(s, index, { weightLb, reps, now: new Date() }));
                // Stay on this card after its last set, so the effort question stays in view.
                setChosen(index);
              }}
              onRate={(setIndex, effort) =>
                updateWorkoutState((s) => rateSet(s, index, setIndex, effort))
              }
              onUndo={() => updateWorkoutState((s) => removeLastSet(s, index))}
              onStop={() => {
                updateWorkoutState((s) => setStopped(s, index, true));
                setChosen(null);
              }}
              onResume={() => {
                updateWorkoutState((s) => setStopped(s, index, false));
                setChosen(index);
              }}
              onNext={nextIndex >= 0 ? () => setChosen(nextIndex) : null}
            />
          );
        })}
      </ScrollViewWithFooter>
    </SafeAreaView>
  );
}
