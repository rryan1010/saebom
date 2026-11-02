// Day 3's check on the local stack (§14), and §15's "an email that wasn't invited can't sign up;
// anonymous sign-in works; manual linking is off", end to end through Auth's API. The pgTAP tests
// cover the invite hook and the demo-user trigger as SQL; this proves Auth really calls them
// (config.toml's hook URI, supabase_auth_admin's grants and RLS policy). It reads the URL and keys
// from `supabase status`, refuses anything but a local API URL, never prints a key or token, and
// removes the users and invite it makes. Runs on Node 24 (.nvmrc) once `npx supabase start` is up:
// `npm run test:auth`.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

type Json = Record<string, unknown>;
type Reply = { status: number; body: Json };
type Key = 'publishable' | 'secret';

const INVITE_ONLY = 'This app is invite-only.';
const PASSWORD = 'correct horse battery staple';

function localStack(): { apiUrl: string; publishableKey: string; secretKey: string } {
  const out = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const status = JSON.parse(out.slice(out.indexOf('{'))) as Json;
  const field = (name: string): string => {
    const value = status[name];
    if (typeof value !== 'string' || value === '') {
      throw new Error(`supabase status has no ${name}; start the local stack first`);
    }
    return value;
  };
  const apiUrl = field('API_URL');
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(apiUrl)) {
    throw new Error('check-auth runs only against the local stack');
  }
  return {
    apiUrl,
    publishableKey: field('PUBLISHABLE_KEY'),
    secretKey: field('SECRET_KEY'),
  };
}

const stack = localStack();

async function call(
  path: string,
  options: { method?: string; body?: unknown; key?: Key; token?: string; prefer?: string } = {},
): Promise<Reply> {
  const key = options.key === 'secret' ? stack.secretKey : stack.publishableKey;
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' };
  const bearer = options.token ?? (options.key === 'secret' ? key : undefined);
  if (bearer !== undefined) headers.authorization = `Bearer ${bearer}`;
  if (options.prefer !== undefined) headers.prefer = options.prefer;
  const res = await fetch(`${stack.apiUrl}${path}`, {
    method: options.method ?? 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });
  const text = await res.text();
  let body: Json = {};
  if (text !== '') {
    const parsed: unknown = JSON.parse(text);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Json;
    }
  }
  return { status: res.status, body };
}

function userOf(reply: Reply): Json {
  const user = reply.body.user ?? reply.body;
  assert.ok(user !== null && typeof user === 'object', 'the reply carries a user');
  return user as Json;
}

function idOf(user: Json): string {
  assert.equal(typeof user.id, 'string', 'the user has an id');
  return user.id as string;
}

// Unique per run, so a rerun or a run that died before cleaning up never collides.
const run = randomUUID().slice(0, 8);
const uninvited = `uninvited-${run}@example.com`;
const invited = `invited-${run}@example.com`;
const madeUsers: string[] = [];
let demo: { id: string; token: string; refreshToken: string } | undefined;

before(async () => {
  const added = await call('/rest/v1/invites', {
    key: 'secret',
    body: { email: invited },
    prefer: 'return=minimal',
  });
  assert.equal(added.status, 201, 'the test invite was added');
});

after(async () => {
  for (const id of madeUsers) {
    await call(`/auth/v1/admin/users/${id}`, { method: 'DELETE', key: 'secret' });
  }
  await call(`/rest/v1/invites?email=eq.${encodeURIComponent(invited)}`, {
    method: 'DELETE',
    key: 'secret',
  });
});

test('anonymous sign-in still works, for demo mode', async () => {
  const reply = await call('/auth/v1/signup', { body: {} });
  assert.equal(reply.status, 200);
  const user = userOf(reply);
  assert.equal(user.is_anonymous, true);
  assert.equal(typeof reply.body.access_token, 'string', 'the demo gets a session');
  assert.equal(typeof reply.body.refresh_token, 'string', 'the demo can refresh its session');
  demo = {
    id: idOf(user),
    token: reply.body.access_token as string,
    refreshToken: reply.body.refresh_token as string,
  };
  madeUsers.push(demo.id);
});

test('a demo session still refreshes', async () => {
  assert.ok(demo, 'needs the demo session from the anonymous sign-in test');
  const reply = await call('/auth/v1/token?grant_type=refresh_token', {
    body: { refresh_token: demo.refreshToken },
  });
  assert.equal(reply.status, 200);
  assert.equal(userOf(reply).is_anonymous, true);
  assert.equal(typeof reply.body.access_token, 'string');
  demo.token = reply.body.access_token as string;
});

test("an email that wasn't invited can't sign up with a password", async () => {
  const reply = await call('/auth/v1/signup', { body: { email: uninvited, password: PASSWORD } });
  assert.equal(reply.status, 403);
  assert.equal(reply.body.msg, INVITE_ONLY);
  assert.equal(reply.body.access_token, undefined, 'no session');
});

test("an email that wasn't invited can't sign up with an email code", async () => {
  const reply = await call('/auth/v1/otp', { body: { email: uninvited, create_user: true } });
  assert.equal(reply.status, 403);
  assert.equal(reply.body.msg, INVITE_ONLY);
});

test('an invited email gets past the hook, in any letter case', async () => {
  const reply = await call('/auth/v1/signup', {
    body: { email: invited.toUpperCase(), password: PASSWORD },
  });
  assert.equal(reply.status, 200);
  const user = userOf(reply);
  madeUsers.push(idOf(user));
  assert.equal(user.email, invited);
  assert.equal(user.is_anonymous, false);
});

test("a demo session can't become an account with an email", async () => {
  assert.ok(demo, 'needs the demo session from the anonymous sign-in test');
  const changed = await call('/auth/v1/user', {
    method: 'PUT',
    token: demo.token,
    body: { email: uninvited },
  });
  assert.ok(changed.status >= 400, `adding an email was refused (got ${changed.status})`);

  const stored = await call(`/auth/v1/admin/users/${demo.id}`, { method: 'GET', key: 'secret' });
  assert.equal(stored.status, 200);
  const user = userOf(stored);
  assert.equal(user.is_anonymous, true, 'the demo user is still anonymous');
  assert.ok(!user.email, 'the demo user has no email');

  const signIn = await call('/auth/v1/token?grant_type=password', {
    body: { email: uninvited, password: PASSWORD },
  });
  assert.equal(signIn.status, 400, 'nobody can sign in with that email');
});

test('manual linking is off', async () => {
  assert.ok(demo, 'needs the demo session from the anonymous sign-in test');
  const reply = await call('/auth/v1/user/identities/authorize?provider=github', {
    method: 'GET',
    token: demo.token,
  });
  assert.equal(reply.status, 404);
  assert.equal(reply.body.error_code, 'manual_linking_disabled');
});
