import { describe, expect, it } from 'vitest';

import {
  authStatusFor,
  claimsOf,
  factsFor,
  parseStoredSession,
  PASSWORD_SESSION_KEY,
  type AuthFacts,
  type AuthStatus,
} from './auth-state.ts';

type SessionFacts = Extract<AuthFacts, { hasSession: true }>;

const base: SessionFacts = {
  hasSession: true,
  isAnonymous: false,
  currentLevel: 'aal1',
  hasVerifiedTotp: false,
  signedInWithPassword: false,
  passwordSetForSession: false,
};

const step = (name: string, facts: AuthFacts, expected: AuthStatus) => ({ name, facts, expected });

const paths = {
  'invite: code, set password, enroll, app': [
    step('before signing in', { hasSession: false }, 'signedOut'),
    step('code verified', base, 'needsPassword'),
    step('password set', { ...base, passwordSetForSession: true }, 'needsEnrollment'),
    step(
      'authenticator verified',
      {
        ...base,
        passwordSetForSession: true,
        hasVerifiedTotp: true,
        currentLevel: 'aal2',
      },
      'signedIn',
    ),
  ],
  'reset (D72): code, challenge, set password, app': [
    step('before signing in', { hasSession: false }, 'signedOut'),
    step('code verified', { ...base, hasVerifiedTotp: true }, 'needsChallenge'),
    step(
      'challenge passed',
      { ...base, hasVerifiedTotp: true, currentLevel: 'aal2' },
      'needsPassword',
    ),
    step(
      'password set',
      { ...base, hasVerifiedTotp: true, currentLevel: 'aal2', passwordSetForSession: true },
      'signedIn',
    ),
  ],
  'password sign-in: password, challenge, app': [
    step('before signing in', { hasSession: false }, 'signedOut'),
    step(
      'password accepted',
      { ...base, hasVerifiedTotp: true, signedInWithPassword: true },
      'needsChallenge',
    ),
    step(
      'challenge passed',
      { ...base, hasVerifiedTotp: true, signedInWithPassword: true, currentLevel: 'aal2' },
      'signedIn',
    ),
  ],
} satisfies Record<string, ReturnType<typeof step>[]>;

describe('authStatusFor', () => {
  for (const [path, steps] of Object.entries(paths)) {
    describe(path, () => {
      it.each(steps.map((s) => [s.name, s.facts, s.expected] as const))(
        '%s',
        (_name, facts, expected) => {
          expect(authStatusFor(facts)).toBe(expected);
        },
      );
    });
  }

  it('treats a demo session as signed in without MFA or a password', () => {
    expect(authStatusFor({ ...base, isAnonymous: true })).toBe('signedIn');
  });

  it('asks for a challenge when the level is unknown', () => {
    expect(authStatusFor({ ...base, hasVerifiedTotp: true, currentLevel: null })).toBe(
      'needsChallenge',
    );
  });

  it('does not enroll before a password exists', () => {
    expect(authStatusFor(base)).toBe('needsPassword');
  });
});

const tokenWith = (claims: object) =>
  `header.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.signature`;

const SESSION_ID = '0b9c7a52-3f1e-4d2a-9c8e-7a6b5c4d3e2f';
const VERIFIED = [{ factor_type: 'totp', status: 'verified' }];

describe('claimsOf', () => {
  it('reads the session id, level and methods from an unpadded base64url payload', () => {
    const token = tokenWith({
      session_id: SESSION_ID,
      aal: 'aal2',
      amr: [{ method: 'otp', timestamp: 1 }, 'totp'],
    });
    expect(claimsOf(token)).toEqual({
      sessionId: SESSION_ID,
      level: 'aal2',
      methods: ['otp', 'totp'],
    });
  });

  it('drops claims it does not recognise', () => {
    expect(claimsOf(tokenWith({ session_id: 42, aal: 'aal3', amr: [{}, 7] }))).toEqual({
      sessionId: null,
      level: null,
      methods: [],
    });
    expect(claimsOf('not-a-jwt')).toEqual({ sessionId: null, level: null, methods: [] });
    expect(claimsOf('a.%%%.c')).toEqual({ sessionId: null, level: null, methods: [] });
  });
});

describe('factsFor', () => {
  it('reports no session', () => {
    expect(factsFor(null)).toEqual({ hasSession: false });
  });

  it('routes a code sign-in to set a password, then to enrollment once this session set one', () => {
    const token = tokenWith({ session_id: SESSION_ID, aal: 'aal1', amr: [{ method: 'otp' }] });
    expect(authStatusFor(factsFor({ access_token: token, user: {} }))).toBe('needsPassword');
    const afterPassword = {
      access_token: token,
      user: { user_metadata: { [PASSWORD_SESSION_KEY]: SESSION_ID } },
    };
    expect(authStatusFor(factsFor(afterPassword))).toBe('needsEnrollment');
  });

  it('asks again for a password when the saved id belongs to an earlier session', () => {
    const token = tokenWith({ session_id: SESSION_ID, aal: 'aal2', amr: ['otp', 'totp'] });
    const session = {
      access_token: token,
      user: { factors: VERIFIED, user_metadata: { [PASSWORD_SESSION_KEY]: 'an-earlier-session' } },
    };
    expect(authStatusFor(factsFor(session))).toBe('needsPassword');
  });

  it('lets a password sign-in that passed MFA into the app', () => {
    const token = tokenWith({ session_id: SESSION_ID, aal: 'aal2', amr: ['password', 'totp'] });
    expect(authStatusFor(factsFor({ access_token: token, user: { factors: VERIFIED } }))).toBe(
      'signedIn',
    );
  });

  it('trusts an aal2 token when the cached user has no verified factor yet', () => {
    const token = tokenWith({ session_id: SESSION_ID, aal: 'aal2', amr: ['password', 'totp'] });
    expect(authStatusFor(factsFor({ access_token: token, user: { factors: [] } }))).toBe(
      'signedIn',
    );
  });
});

describe('parseStoredSession', () => {
  it('keeps a stored aal2 session signed in, as when the phone is offline', () => {
    const token = tokenWith({ session_id: SESSION_ID, aal: 'aal2', amr: ['password', 'totp'] });
    const stored = JSON.stringify({
      access_token: token,
      refresh_token: 'r',
      expires_at: 0,
      user: { id: 'u', factors: VERIFIED, user_metadata: {} },
    });
    expect(authStatusFor(factsFor(parseStoredSession(stored)))).toBe('signedIn');
  });

  it('is null for nothing stored or anything that is not a session', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('not json')).toBeNull();
    expect(parseStoredSession('{"access_token":1,"user":{}}')).toBeNull();
    expect(parseStoredSession('{"access_token":"t"}')).toBeNull();
  });
});
