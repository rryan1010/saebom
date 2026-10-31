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

// The part of a Supabase session the gate reads; auth-js sessions and stored sessions both fit.
export type SessionLike = {
  access_token: string;
  user: {
    is_anonymous?: boolean;
    factors?: readonly { factor_type: string; status: string }[];
    user_metadata?: Record<string, unknown>;
  };
};

type Claims = {
  sessionId: string | null;
  level: 'aal1' | 'aal2' | null;
  methods: string[];
};

// Saved in user_metadata with the password: a code sign-in's session never gains the password
// method, so the session id is what proves this session already set one, across relaunches.
export const PASSWORD_SESSION_KEY = 'password_set_session';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function claimsOf(accessToken: string): Claims {
  const none: Claims = { sessionId: null, level: null, methods: [] };
  const payload = accessToken.split('.')[1];
  if (payload === undefined) return none;
  let claims: unknown;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
  } catch {
    return none;
  }
  if (!isRecord(claims)) return none;
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  return {
    sessionId: typeof claims.session_id === 'string' ? claims.session_id : null,
    level: claims.aal === 'aal1' || claims.aal === 'aal2' ? claims.aal : null,
    methods: amr.flatMap((entry: unknown) =>
      typeof entry === 'string'
        ? [entry]
        : isRecord(entry) && typeof entry.method === 'string'
          ? [entry.method]
          : [],
    ),
  };
}

export function factsFor(session: SessionLike | null): AuthFacts {
  if (session === null) return { hasSession: false };
  const claims = claimsOf(session.access_token);
  const hasVerifiedFactor = (session.user.factors ?? []).some(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
  );
  return {
    hasSession: true,
    isAnonymous: session.user.is_anonymous === true,
    currentLevel: claims.level,
    // An aal2 session proves a verified factor even when the cached user is stale.
    hasVerifiedTotp: hasVerifiedFactor || claims.level === 'aal2',
    signedInWithPassword: claims.methods.includes('password'),
    passwordSetForSession:
      claims.sessionId !== null &&
      session.user.user_metadata?.[PASSWORD_SESSION_KEY] === claims.sessionId,
  };
}

export function parseStoredSession(raw: string | null): SessionLike | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.access_token !== 'string' || !isRecord(value.user)) {
    return null;
  }
  const user = value.user;
  return {
    access_token: value.access_token,
    user: {
      is_anonymous: user.is_anonymous === true,
      factors: Array.isArray(user.factors)
        ? user.factors.filter(
            (f: unknown): f is { factor_type: string; status: string } =>
              isRecord(f) && typeof f.factor_type === 'string' && typeof f.status === 'string',
          )
        : [],
      user_metadata: isRecord(user.user_metadata) ? user.user_metadata : {},
    },
  };
}

export function authStatusFor(facts: AuthFacts): AuthStatus {
  if (!facts.hasSession) return 'signedOut';
  if (facts.isAnonymous) return 'signedIn';
  if (facts.hasVerifiedTotp && facts.currentLevel !== 'aal2') return 'needsChallenge';
  if (!facts.signedInWithPassword && !facts.passwordSetForSession) return 'needsPassword';
  if (!facts.hasVerifiedTotp) return 'needsEnrollment';
  return 'signedIn';
}
