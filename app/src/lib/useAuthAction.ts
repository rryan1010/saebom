import { useRef, useState } from 'react';

import { authErrorMessage } from '@/lib/auth-errors';

export function useAuthAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not `busy`: the keyboard's submit key can fire twice before React re-renders, and a
  // second verifyOtp would spend the single-use code.
  const inFlight = useRef(false);

  async function run(action: () => Promise<{ error: unknown }>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
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
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { busy, error, setError, run };
}
