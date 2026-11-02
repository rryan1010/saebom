import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { createPlan, DEFAULT_PROFILE } from '@/lib/workout';
import { getWorkoutState, updateWorkoutState } from '@/lib/workout-store';
import { Muted } from '@/ui/Card';
import { PrimaryButton } from '@/ui/PrimaryButton';
import { ProfileForm } from '@/ui/ProfileForm';
import { Screen } from '@/ui/Screen';
import { TextButton } from '@/ui/TextButton';
import { SPACE } from '@/ui/theme';

export default function EditProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState(() => getWorkoutState().profile ?? DEFAULT_PROFILE);

  const save = () => {
    updateWorkoutState((state) => (state.active ? state : createPlan(state, profile)));
    router.back();
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      title="Your profile"
      subtitle="Saving rebuilds your plan. Exercises that stay keep their weights; new ones start with a calibration set."
    >
      <ProfileForm value={profile} onChange={setProfile} />
      {profile.avoidAreas.length > 0 ? (
        <Muted small>
          A new injured area is worth a check with a doctor or physical therapist.
        </Muted>
      ) : null}
      <View style={{ gap: SPACE.sm }}>
        <PrimaryButton label="Save and rebuild plan" onPress={save} />
        <TextButton label="Cancel" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
