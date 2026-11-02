import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { createPlan, DEFAULT_PROFILE } from '@/lib/workout';
import { updateWorkoutState } from '@/lib/workout-store';
import { Card } from '@/ui/Card';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { ProfileForm } from '@/ui/ProfileForm';
import { Screen } from '@/ui/Screen';
import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

// The readiness warning every lifter sees before the first plan, word for word from handoff §7
// (D49). It never blocks the plan and asks for no doctor's approval.
const READINESS_WARNING =
  'Lifting is hard on your body. If you have a heart, lung or joint condition, chest pain, dizziness, a recent injury or surgery, or you’re pregnant, the safest step is to talk to a doctor first. Only start if you’re certain it’s safe for you, and stop right away if anything feels wrong.';

export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  const build = () => {
    updateWorkoutState((state) => createPlan(state, profile));
    router.replace('/');
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      header={
        <Text
          accessibilityLabel="Saebom"
          style={[TYPE.largeTitle, { color: colors.accent, fontSize: 44, lineHeight: 52 }]}
        >
          새봄
        </Text>
      }
      title="Build your plan"
      subtitle="Answer five questions and Saebom builds a safe starting plan from fixed rules. Everything stays on this phone."
    >
      <ProfileForm value={profile} onChange={setProfile} />
      <Card eyebrow="Before you start">
        <Text style={[TYPE.body, { color: colors.text }]}>{READINESS_WARNING}</Text>
      </Card>
      <View style={{ gap: SPACE.sm }}>
        <PrimaryButton label="I understand, build my plan" onPress={build} />
      </View>
    </Screen>
  );
}
