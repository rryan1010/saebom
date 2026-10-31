import { describe, expect, it } from 'vitest';

import {
  assuranceLevelOf,
  authStatusFor,
  includesPasswordMethod,
  sessionIdOf,
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
  'reset: code, challenge, set password, app': [
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

describe('includesPasswordMethod', () => {
  it('reads RFC 8176 strings', () => {
    expect(includesPasswordMethod(['otp', 'password'])).toBe(true);
    expect(includesPasswordMethod(['otp', 'totp'])).toBe(false);
  });

  it('reads detailed entries', () => {
    expect(includesPasswordMethod([{ method: 'password' }])).toBe(true);
    expect(includesPasswordMethod([{ method: 'otp' }])).toBe(false);
  });

  it('is false for no methods', () => {
    expect(includesPasswordMethod([])).toBe(false);
  });
});

describe('sessionIdOf', () => {
  const tokenWith = (claims: object) =>
    `header.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.signature`;

  it('reads the session_id claim from an unpadded base64url payload', () => {
    const sessionId = '0b9c7a52-3f1e-4d2a-9c8e-7a6b5c4d3e2f';
    expect(sessionIdOf(tokenWith({ session_id: sessionId, amr: [{ method: 'otp' }] }))).toBe(
      sessionId,
    );
  });

  it('is null for a token without a usable session_id', () => {
    expect(sessionIdOf(tokenWith({ sub: 'someone' }))).toBeNull();
    expect(sessionIdOf(tokenWith({ session_id: 42 }))).toBeNull();
    expect(sessionIdOf('not-a-jwt')).toBeNull();
    expect(sessionIdOf('a.%%%.c')).toBeNull();
  });
});

describe('assuranceLevelOf', () => {
  it('keeps the two known levels and drops anything else', () => {
    expect(assuranceLevelOf('aal1')).toBe('aal1');
    expect(assuranceLevelOf('aal2')).toBe('aal2');
    expect(assuranceLevelOf('aal3')).toBeNull();
    expect(assuranceLevelOf(undefined)).toBeNull();
  });
});
