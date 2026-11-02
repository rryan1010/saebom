import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import {
  REGIONS,
  type EquipmentSetup,
  type Experience,
  type GoalIntensity,
  type Profile,
  type Region,
} from '@shared/rules/index.ts';

import { REGION_LABELS } from '@/lib/workout';
import { Card, Muted } from '@/ui/Card';
import { Chips, type ChipOption } from '@/ui/Chips';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const EXPERIENCE: ChipOption<Experience>[] = [
  { value: 'new', label: 'Under 6 months' },
  { value: 'intermediate', label: '6 months – 2 years' },
  { value: 'experienced', label: '2+ years' },
];

const GOAL: ChipOption<GoalIntensity>[] = [
  { value: 'standard', label: 'Steady' },
  { value: 'intense', label: 'Intense' },
];

const DAYS: ChipOption<number>[] = [2, 3, 4, 5, 6].map((d) => ({ value: d, label: String(d) }));

const EQUIPMENT: ChipOption<EquipmentSetup>[] = [
  { value: 'full_gym', label: 'Full gym' },
  { value: 'dumbbells_only', label: 'Dumbbells + bench' },
];

const AREAS: ChipOption<Region>[] = REGIONS.map((r) => ({ value: r, label: REGION_LABELS[r] }));

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: SPACE.sm }}>
      <Text style={[TYPE.headline, { color: colors.text }]}>{title}</Text>
      {children}
      {hint ? <Muted small>{hint}</Muted> : null}
    </View>
  );
}

type Props = {
  value: Profile;
  onChange: (profile: Profile) => void;
};

/**
 * The profile the rules engine plans from. Injured areas are trained around (D46); training an
 * area light, with its warning, comes after the POC.
 */
export function ProfileForm({ value, onChange }: Props) {
  const set = <K extends keyof Profile>(key: K, v: Profile[K]) => onChange({ ...value, [key]: v });
  const toggleArea = (area: Region) =>
    set(
      'avoidAreas',
      value.avoidAreas.includes(area)
        ? value.avoidAreas.filter((a) => a !== area)
        : [...value.avoidAreas, area],
    );

  return (
    <Card>
      <View style={{ gap: SPACE.lg }}>
        <Question title="How long have you been lifting?">
          <Chips
            options={EXPERIENCE}
            isSelected={(v) => v === value.experience}
            onPress={(v) => set('experience', v)}
          />
        </Question>
        <Question
          title="How hard do you want to train?"
          hint="New lifters start steady either way, so the plan stays safe."
        >
          <Chips
            options={GOAL}
            isSelected={(v) => v === value.goalIntensity}
            onPress={(v) => set('goalIntensity', v)}
          />
        </Question>
        <Question title="Days a week you can train">
          <Chips
            compact
            options={DAYS}
            isSelected={(v) => v === value.daysPerWeek}
            onPress={(v) => set('daysPerWeek', v)}
          />
        </Question>
        <Question title="Where do you train?">
          <Chips
            options={EQUIPMENT}
            isSelected={(v) => v === value.equipment}
            onPress={(v) => set('equipment', v)}
          />
        </Question>
        <Question
          title="Any areas to train around?"
          hint={
            value.avoidAreas.length > 0
              ? 'Your plan leaves out every exercise that loads these areas. For an injury, a doctor or physical therapist is the surest guide; this plan isn’t rehab.'
              : 'Optional. Your plan leaves out exercises that load these areas and works your other muscle groups.'
          }
        >
          <Chips
            options={AREAS}
            isSelected={(v) => value.avoidAreas.includes(v)}
            onPress={toggleArea}
          />
        </Question>
      </View>
    </Card>
  );
}
