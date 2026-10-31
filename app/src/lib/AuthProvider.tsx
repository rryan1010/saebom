import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { authStatusFor, factsFor, parseStoredSession, type AuthStatus } from '@/lib/auth-state';
import { readStoredSession, supabase } from '@/lib/supabase';

const AuthContext = createContext<AuthStatus | null>(null);

async function readStatus(): Promise<AuthStatus> {
  const { data, error } = await supabase.auth.getSession();
  // Offline with an expired access token, auth-js returns no session but keeps the stored one;
  // the gate routes from that stored session so a signed-in tester isn't sent to sign-in.
  const session =
    data.session ??
    (isAuthRetryableFetchError(error) ? parseStoredSession(await readStoredSession()) : null);
  return authStatusFor(factsFor(session));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let latest = 0;

    function refresh() {
      latest += 1;
      const mine = latest;
      readStatus()
        .catch((): AuthStatus => 'signedOut')
        .then((next) => {
          if (mine === latest) setStatus(next);
        });
    }

    const { data } = supabase.auth.onAuthStateChange(() => {
      // auth-js holds its lock while calling this, so awaiting supabase here would deadlock.
      setTimeout(refresh, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={status}>{children}</AuthContext.Provider>;
}

export function useAuthStatus(): AuthStatus {
  const status = useContext(AuthContext);
  if (status === null) throw new Error('useAuthStatus must be used inside AuthProvider');
  return status;
}
