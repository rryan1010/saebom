import { useState } from 'react';

import { authErrorMessage } from '@/lib/auth-errors';

export function useAuthAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ error: unknown }>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        setError(authErrorMessage(result.error));
        return false;
      }
      return true;
    } catch (thrown) {
      setError(authErrorMessage(thrown));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
