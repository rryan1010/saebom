import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  assuranceLevelOf,
  authStatusFor,
  includesPasswordMethod,
  PASSWORD_SESSION_KEY,
  sessionIdOf,
  type AuthFacts,
  type AuthStatus,
} from '@/lib/auth-state';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<AuthStatus | null>(null);

async function readStatus(): Promise<AuthStatus> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (session === null) return authStatusFor({ hasSession: false });

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = assuranceLevelOf(assurance?.currentLevel);
  const hasVerifiedFactor = (session.user.factors ?? []).some(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  );
  const sessionId = sessionIdOf(session.access_token);

  const facts: AuthFacts = {
    hasSession: true,
    isAnonymous: session.user.is_anonymous === true,
    currentLevel,
    // An aal2 session proves a verified factor even when the cached user is stale.
    hasVerifiedTotp: hasVerifiedFactor || currentLevel === 'aal2',
    signedInWithPassword: includesPasswordMethod(assurance?.currentAuthenticationMethods ?? []),
    passwordSetForSession:
      sessionId !== null && session.user.user_metadata[PASSWORD_SESSION_KEY] === sessionId,
  };
  return authStatusFor(facts);
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
