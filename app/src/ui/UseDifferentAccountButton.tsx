import { supabase } from '@/lib/supabase';
import { TextButton } from '@/ui/TextButton';

export function UseDifferentAccountButton() {
  return (
    <TextButton
      label="Use a different account"
      onPress={() => {
        void supabase.auth.signOut({ scope: 'local' });
      }}
    />
  );
}
