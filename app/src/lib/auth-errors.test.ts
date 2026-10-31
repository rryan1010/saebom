import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { authErrorMessage } from './auth-errors.ts';

describe('authErrorMessage', () => {
  it('explains a known error code in plain English', () => {
    const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    expect(authErrorMessage(error)).toBe('That email or password is incorrect.');
  });

  it('gives the same answer for an unknown account as for a wrong password', () => {
    const unknown = new AuthApiError('User not found', 400, 'user_not_found');
    const wrong = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
    expect(authErrorMessage(unknown)).toBe(authErrorMessage(wrong));
  });

  it('reports a network failure as a connection problem', () => {
    const error = new AuthRetryableFetchError('Network request failed', 0);
    expect(authErrorMessage(error)).toBe(
      "Can't reach Saebom. Check your connection and try again.",
    );
  });

  it('falls back for an unknown code, a missing code and non-auth errors', () => {
    const fallback = 'Something went wrong. Try again.';
    expect(authErrorMessage(new AuthApiError('odd', 500, 'brand_new_code'))).toBe(fallback);
    expect(authErrorMessage(new AuthApiError('odd', 500, undefined))).toBe(fallback);
    expect(authErrorMessage(new Error('boom'))).toBe(fallback);
    expect(authErrorMessage(null)).toBe(fallback);
  });

  it('never repeats the server message', () => {
    const error = new AuthApiError('secret detail from the server', 400, 'weak_password');
    expect(authErrorMessage(error)).not.toContain('secret detail');
  });
});
