import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  HARD_EFFORT,
  roundDownToLoad,
  type Effort,
  type Exercise,
  type PlanItem,
} from '@shared/rules/index.ts';

import {
  formatLb,
  MAX_WEIGHT_LB,
  muscleLine,
  newRecordIndexes,
  type ExerciseLog,
} from '@/lib/workout';
import { Card, Muted, Pill } from '@/ui/Card';
import { Ring } from '@/ui/Ring';
import { RoundButton } from '@/ui/RoundButton';
import { Stepper } from '@/ui/Stepper';
import { TextButton } from '@/ui/TextButton';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const EFFORT_LABELS: Record<Effort, string> = { 1: 'Easy', 2: 'OK', 3: 'Hard' };
const EFFORTS: Effort[] = [1, 2, 3];
const MAX_REPS_STEPPER = 30;

type Props = {
  position: number;
  log: ExerciseLog;
  item: PlanItem;
  exercise: Exercise;
  /** This session's target, already one step lighter on a "Go lighter today" day. */
  targetLb: number | null;
  wentLighter: boolean;
  /** Best reps at each weight from earlier sessions, for the record badge. */
  records: ReadonlyMap<string, number>;
  open: boolean;
  startWeightLb: number;
  startReps: number;
  onOpen: () => void;
  onLog: (weightLb: number, reps: number) => void;
  onRate: (setIndex: number, effort: Effort) => void;
  onUndo: () => void;
  onStop: () => void;
  onResume: () => void;
  onNext: (() => void) | null;
};

export function ExerciseCard(props: Props) {
  const { log, item, exercise, open } = props;
  const { colors } = useTheme();
  const [weightLb, setWeightLb] = useState(props.startWeightLb);
  const [reps, setReps] = useState(props.startReps);
  // The set count when the lifter last answered "Lower the weight?", so it asks once per set.
  const [nudgeAnswered, setNudgeAnswered] = useState(-1);

  const count = log.sets.length;
  const done = count >= item.sets;
  const records = newRecordIndexes(props.records, exercise.slug, log.sets);
  const last = log.sets[count - 1];
  const askEffort = !log.stopped && last !== undefined && last.effort === null;
  const tough =
    !log.stopped &&
    last !== undefined &&
    (last.effort === HARD_EFFORT || last.reps < item.repMin) &&
    nudgeAnswered !== count &&
    weightLb > exercise.minLoadLb;
  const perDumbbell = exercise.equipment.length === 1 && exercise.equipment[0] === 'dumbbell';

  const header = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${exercise.name}, ${count} of ${item.sets} sets`}
      onPress={props.onOpen}
      style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}
    >
      <Ring
        size={44}
        strokeWidth={5}
        progress={count / item.sets}
        label={`${count} of ${item.sets} sets`}
      >
        <Text style={[TYPE.caption, { color: colors.text, fontWeight: '800' }]}>
          {done ? '✓' : props.position}
        </Text>
      </Ring>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[TYPE.headline, { color: colors.text }]}>{exercise.name}</Text>
        <Muted small>{muscleLine(exercise)}</Muted>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[TYPE.caption, { color: colors.textSecondary }]}>
          {count}/{item.sets} sets
        </Text>
        {item.isLight ? <Pill label="Light" /> : null}
        {log.stopped ? <Pill label="Stopped" tone="danger" /> : null}
      </View>
    </Pressable>
  );

  const setChips =
    count > 0 ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
        {log.sets.map((set, i) => (
          <View
            key={set.loggedAt + i}
            accessible
            accessibilityLabel={`Set ${i + 1}: ${set.weightLb} pounds, ${set.reps} reps${set.effort ? `, ${EFFORT_LABELS[set.effort]}` : ''}${records.has(i) ? ', new rep record' : ''}`}
            style={{
              borderRadius: 14,
              paddingHorizontal: SPACE.sm,
              paddingVertical: SPACE.xs,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: records.has(i) ? colors.accent : colors.border,
            }}
          >
            <Text style={[TYPE.caption, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
              {set.weightLb} × {set.reps}
              {set.effort ? ` · ${EFFORT_LABELS[set.effort]}` : ''}
            </Text>
            {records.has(i) ? (
              <Text style={[TYPE.caption, { color: colors.accent }]}>New rep record</Text>
            ) : null}
          </View>
        ))}
      </View>
    ) : null;

  if (!open) {
    return (
      <Card>
        {header}
        {setChips}
      </Card>
    );
  }

  const target =
    props.targetLb === null
      ? `Calibration: pick a light weight you could lift for ${item.repMin}–${item.repMax} reps with plenty left.`
      : `Target ${formatLb(props.targetLb)}${props.wentLighter ? ' (lighter today)' : ''} · ${item.repMin}–${item.repMax} reps · ${item.rir}+ in reserve`;

  return (
    <Card highlighted>
      {header}
      <Text style={[TYPE.body, { color: colors.text }]}>{target}</Text>
      {exercise.cues.map((cue) => (
        <Muted key={cue} small>
          • {cue}
        </Muted>
      ))}
      {setChips}

      {log.stopped ? (
        <View style={{ gap: SPACE.sm }}>
          <Muted>
            Stopped. Your logged sets are kept and this exercise’s target stays the same. If an area
            keeps hurting, add it under Settings so your plan trains around it.
          </Muted>
          <TextButton label="Resume this exercise" onPress={props.onResume} />
        </View>
      ) : (
        <View style={{ gap: SPACE.md }}>
          {askEffort ? (
            <View style={{ gap: SPACE.sm }}>
              <Text style={[TYPE.headline, { color: colors.text }]}>How did that set feel?</Text>
              <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                {EFFORTS.map((effort) => (
                  <View key={effort} style={{ flex: 1 }}>
                    <RoundButton
                      label={EFFORT_LABELS[effort]}
                      variant="outline"
                      size={64}
                      accessibilityLabel={`Set felt ${EFFORT_LABELS[effort]}`}
                      onPress={() => props.onRate(count - 1, effort)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {tough ? (
            <View
              style={{
                gap: SPACE.sm,
                padding: SPACE.md,
                borderRadius: 16,
                backgroundColor: colors.background,
              }}
            >
              <Text style={[TYPE.headline, { color: colors.text }]}>
                That looked tough. Lower the weight for your next set?
              </Text>
              <View style={{ flexDirection: 'row', gap: SPACE.sm, justifyContent: 'flex-end' }}>
                <TextButton label="Keep it" onPress={() => setNudgeAnswered(count)} />
                <TextButton
                  label="Lower it"
                  onPress={() => {
                    setWeightLb(roundDownToLoad(weightLb - exercise.incrementLb, exercise));
                    setNudgeAnswered(count);
                  }}
                />
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: SPACE.md }}>
            <Stepper
              label={perDumbbell ? 'Weight per dumbbell' : 'Weight'}
              value={weightLb}
              step={exercise.incrementLb}
              min={exercise.minLoadLb}
              max={MAX_WEIGHT_LB}
              format={formatLb}
              onChange={setWeightLb}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: SPACE.md }}>
            <Stepper
              label="Reps"
              value={reps}
              step={1}
              min={1}
              max={MAX_REPS_STEPPER}
              format={(r) => String(r)}
              onChange={setReps}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
            <RoundButton
              label="Log set"
              size={84}
              accessibilityLabel={`Log set ${count + 1}: ${weightLb} pounds, ${reps} reps`}
              onPress={() => props.onLog(weightLb, reps)}
            />
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              {count > 0 ? <TextButton label="Undo last set" onPress={props.onUndo} /> : null}
              <TextButton label="Pain? Stop" tone="danger" onPress={props.onStop} />
              {done && props.onNext ? (
                <TextButton label="Next exercise" onPress={props.onNext} />
              ) : null}
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}
