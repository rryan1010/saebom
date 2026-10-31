import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

const FALLBACK = 'Something went wrong. Try again.';
const OFFLINE = "Can't reach Saebom. Check your connection and try again.";

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email or password is incorrect.',
  email_not_confirmed: 'That email or password is incorrect.',
  otp_expired:
    'That code has expired or was already used. Ask the person who invited you for a new one.',
  otp_disabled: FALLBACK,
  mfa_verification_failed: "That code didn't match. Wait for a fresh one and try again.",
  mfa_verification_rejected: "That code didn't match. Wait for a fresh one and try again.",
  mfa_challenge_expired: 'That took too long. Try again.',
  mfa_factor_not_found: 'Set up your authenticator app again to continue.',
  too_many_enrolled_mfa_factors: 'An authenticator app is already set up for this account.',
  mfa_verified_factor_exists: 'An authenticator app is already set up for this account.',
  weak_password: 'Choose a longer or less common password.',
  same_password: 'Choose a different password from your current one.',
  over_request_rate_limit: 'Too many tries. Wait a minute and try again.',
  over_email_send_rate_limit: 'Too many tries. Wait a minute and try again.',
  user_banned: 'This account is not available.',
  user_not_found: 'That email or password is incorrect.',
  session_expired: 'Your session expired. Sign in again.',
  session_not_found: 'Your session expired. Sign in again.',
  refresh_token_not_found: 'Your session expired. Sign in again.',
  refresh_token_already_used: 'Your session expired. Sign in again.',
  insufficient_aal: 'Enter a code from your authenticator app to continue.',
  request_timeout: OFFLINE,
};

export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return OFFLINE;
  if (isAuthError(error) && error.code !== undefined) return MESSAGES[error.code] ?? FALLBACK;
  return FALLBACK;
}
