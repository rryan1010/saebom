export type AuthStatus =
  'loading' | 'signedOut' | 'needsChallenge' | 'needsPassword' | 'needsEnrollment' | 'signedIn';

export type AuthFacts =
  | { hasSession: false }
  | {
      hasSession: true;
      isAnonymous: boolean;
      currentLevel: 'aal1' | 'aal2' | null;
      hasVerifiedTotp: boolean;
      signedInWithPassword: boolean;
      passwordSetForSession: boolean;
    };

// Saved in user_metadata with the password: a code sign-in's session never gains the password
// method, so the session id is what proves this session already set one, across relaunches.
export const PASSWORD_SESSION_KEY = 'password_set_session';

export function authStatusFor(facts: AuthFacts): AuthStatus {
  if (!facts.hasSession) return 'signedOut';
  if (facts.isAnonymous) return 'signedIn';
  if (facts.hasVerifiedTotp && facts.currentLevel !== 'aal2') return 'needsChallenge';
  if (!facts.signedInWithPassword && !facts.passwordSetForSession) return 'needsPassword';
  if (!facts.hasVerifiedTotp) return 'needsEnrollment';
  return 'signedIn';
}

type AuthenticationMethods = readonly (string | { method: string })[];

export function includesPasswordMethod(methods: AuthenticationMethods): boolean {
  return methods.some((entry) => (typeof entry === 'string' ? entry : entry.method) === 'password');
}

export function sessionIdOf(accessToken: string): string | null {
  const payload = accessToken.split('.')[1];
  if (payload === undefined) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    if (typeof claims !== 'object' || claims === null || !('session_id' in claims)) return null;
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
}

export function assuranceLevelOf(level: string | null | undefined): 'aal1' | 'aal2' | null {
  if (level === 'aal1') return 'aal1';
  if (level === 'aal2') return 'aal2';
  return null;
}
