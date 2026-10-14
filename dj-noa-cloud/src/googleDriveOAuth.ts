/**
 * DJ NOA CLOUD — dedicated Google Drive OAuth adapter.
 *
 * STAGING ONLY: deliberately NOT attached to HTTP routes. OAuth must be gated
 * behind server-side login + state/PKCE persistence + session-bound callbacks
 * before these helpers may be called from a deployed Worker.
 *
 * Never import environment variables, OAuth tokens, storage IDs or account
 * registries from HAVANA CLOUD or the current DJ NOA PWA.
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token' as const;
const IDENTITY_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo' as const;
export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file' as const;
export const DJ_NOA_DRIVE_SCOPES = ['openid', 'email', GOOGLE_DRIVE_FILE_SCOPE] as const;

export type DJNoaDriveOAuthEnv = {
  /** Independent HTTPS host for DJ NOA CLOUD only — not the existing PWA */
  DJ_NOA_CLOUD_ORIGIN?: string;
  DJ_NOA_GOOGLE_CLIENT_ID?: string;
  DJ_NOA_GOOGLE_CLIENT_SECRET?: string;
  /** Account allowlist is required, not optional. Prevent accidental cross-login. */
  DJ_NOA_ALLOWED_GOOGLE_EMAIL?: string;
};

export type ValidatedDJNoaDriveConfig = Readonly<{
  origin: string;
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  allowedEmail: string;
}>;

export type DJNoaOAuthTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}>;

function mandatory(value: string | undefined): string {
  if (!value || !value.trim() || /[\r\n\0]/.test(value)) throw Error('dj_noa_cloud_setup_required');
  return value.trim();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * All Google OAuth configuration must be provided by the new independent
 * deployment. No hostname, account or client-ID fallbacks are allowed.
 */
export function validateDJNoaDriveConfig(env: DJNoaDriveOAuthEnv): ValidatedDJNoaDriveConfig {
  const rawOrigin = mandatory(env.DJ_NOA_CLOUD_ORIGIN);
  let parsed: URL;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    throw Error('invalid_dj_noa_cloud_origin');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.search || parsed.hash || parsed.pathname !== '/' ||
      rawOrigin !== parsed.origin || !parsed.hostname.includes('.') ||
      /(?:havana-nice-cloud|dj-noa-pwa)/i.test(parsed.hostname)) {
    throw Error('invalid_dj_noa_cloud_origin');
  }

  const clientId = mandatory(env.DJ_NOA_GOOGLE_CLIENT_ID);
  const clientSecret = mandatory(env.DJ_NOA_GOOGLE_CLIENT_SECRET);
  const allowedEmail = mandatory(env.DJ_NOA_ALLOWED_GOOGLE_EMAIL).toLowerCase();
  if (!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId) ||
      clientSecret.length < 12 || !validEmail(allowedEmail)) {
    throw Error('invalid_dj_noa_google_oauth_config');
  }

  return {
    origin: parsed.origin,
    callbackUrl: parsed.origin + '/api/oauth/google/callback',
    clientId,
    clientSecret,
    allowedEmail
  };
}

function validateRandomParameter(value: string, label: string): string {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(value)) throw Error('invalid_' + label);
  return value;
}

export function makeDJNoaDriveConsentUrl(
  config: ValidatedDJNoaDriveConfig,
  params: { state: string; codeChallenge: string }
): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.callbackUrl);
  url.searchParams.set('scope', DJ_NOA_DRIVE_SCOPES.join(' '));
  url.searchParams.set('state', validateRandomParameter(params.state, 'oauth_state'));
  url.searchParams.set('code_challenge', validateRandomParameter(params.codeChallenge, 'pkce_challenge'));
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'false');
  return url.toString();
}

/** Never include refresh tokens in errors, logs, client responses or browser storage. */
export async function exchangeDJNoaDriveCode(
  config: ValidatedDJNoaDriveConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch
): Promise<DJNoaOAuthTokens> {
  if (!code.trim() || code.length > 4096 || /[\r\n\0]/.test(code)) throw Error('invalid_oauth_code');
  validateRandomParameter(codeVerifier, 'pkce_verifier');

  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept': 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: codeVerifier,
      redirect_uri: config.callbackUrl,
      grant_type: 'authorization_code'
    }).toString(),
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) throw Error('dj_noa_oauth_exchange_failed');
  const raw = await response.json() as Record<string, unknown>;
  if (raw.token_type !== 'Bearer' || typeof raw.access_token !== 'string' ||
      raw.access_token.length < 10 || typeof raw.refresh_token !== 'string' ||
      raw.refresh_token.length < 10 || typeof raw.expires_in !== 'number' ||
      !Number.isFinite(raw.expires_in) || raw.expires_in < 1) {
    throw Error('invalid_dj_noa_oauth_response');
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresIn: raw.expires_in
  };
}

/** Do not store tokens until this returns the exclusively permitted account. */
export async function verifyDJNoaDriveIdentity(
  config: ValidatedDJNoaDriveConfig,
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ email: string; googleSubject: string }> {
  if (accessToken.length < 10) throw Error('invalid_access_token');
  const response = await fetchImpl(IDENTITY_ENDPOINT, {
    headers: { 'authorization': 'Bearer ' + accessToken, 'accept': 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Error('dj_noa_google_identity_failed');

  const profile = await response.json() as Record<string, unknown>;
  if (typeof profile.sub !== 'string' || !profile.sub ||
      profile.email_verified !== true || typeof profile.email !== 'string' ||
      profile.email.trim().toLowerCase() !== config.allowedEmail) {
    throw Error('dj_noa_google_account_not_allowed');
  }
  return { email: config.allowedEmail, googleSubject: profile.sub };
}

export async function refreshDJNoaDriveAccessToken(
  config: ValidatedDJNoaDriveConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ accessToken: string; expiresIn: number }> {
  if (!refreshToken || refreshToken.length < 10) throw Error('invalid_refresh_token');
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept': 'application/json' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString(),
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw Error('dj_noa_google_refresh_failed');
  const raw = await response.json() as Record<string, unknown>;
  if (raw.token_type !== 'Bearer' || typeof raw.access_token !== 'string' ||
      raw.access_token.length < 10 || typeof raw.expires_in !== 'number' ||
      !Number.isFinite(raw.expires_in) || raw.expires_in < 1) {
    throw Error('invalid_dj_noa_refresh_response');
  }
  return { accessToken: raw.access_token, expiresIn: raw.expires_in };
}
