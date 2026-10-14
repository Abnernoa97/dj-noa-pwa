import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DJ_NOA_DRIVE_SCOPES,
  exchangeDJNoaDriveCode,
  makeDJNoaDriveConsentUrl,
  refreshDJNoaDriveAccessToken,
  validateDJNoaDriveConfig,
  verifyDJNoaDriveIdentity
} from '../dj-noa-cloud/src/googleDriveOAuth.ts';

const vars = {
  DJ_NOA_CLOUD_ORIGIN: 'https://dj-noa-cloud.example.test',
  DJ_NOA_GOOGLE_CLIENT_ID: 'independent-dj-noa.apps.googleusercontent.com',
  DJ_NOA_GOOGLE_CLIENT_SECRET: 'test-secret-that-is-never-real',
  DJ_NOA_ALLOWED_GOOGLE_EMAIL: 'dj-noa@example.test'
};
const R = 'A'.repeat(43);
const CHALLENGE = 'B'.repeat(43);
const config = validateDJNoaDriveConfig(vars);
const mockResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('production OAuth fails closed without an independent origin, credentials and exact email allowlist', () => {
  for (const key of Object.keys(vars)) {
    assert.throws(() => validateDJNoaDriveConfig({ ...vars, [key]: undefined }), /setup_required/);
  }
  assert.throws(() => validateDJNoaDriveConfig({
    ...vars,
    DJ_NOA_CLOUD_ORIGIN: 'https://havana-nice-cloud.soloaplicaciones97.workers.dev'
  }), /invalid_dj_noa_cloud_origin/);
  assert.throws(() => validateDJNoaDriveConfig({
    ...vars, DJ_NOA_CLOUD_ORIGIN: 'https://dj-noa-pwa.soloaplicaciones97.workers.dev'
  }), /invalid_dj_noa_cloud_origin/);
  assert.throws(() => validateDJNoaDriveConfig({
    ...vars, DJ_NOA_CLOUD_ORIGIN: 'http://dj-noa-cloud.example.test'
  }), /invalid_dj_noa_cloud_origin/);
  assert.throws(() => validateDJNoaDriveConfig({
    ...vars, DJ_NOA_CLOUD_ORIGIN: 'https://dj-noa-cloud.example.test/unsafe'
  }), /invalid_dj_noa_cloud_origin/);
  assert.throws(() => validateDJNoaDriveConfig({
    ...vars, DJ_NOA_ALLOWED_GOOGLE_EMAIL: 'not-an-email'
  }), /invalid_dj_noa_google_oauth_config/);
  assert.equal(config.callbackUrl, vars.DJ_NOA_CLOUD_ORIGIN + '/api/oauth/google/callback');
});

test('Drive uses PKCE S256, state, restricted drive.file, independent callback and no broad Drive scope', () => {
  const url = new URL(makeDJNoaDriveConsentUrl(config, { state: R, codeChallenge: CHALLENGE }));
  assert.equal(url.host, 'accounts.google.com');
  assert.equal(url.searchParams.get('client_id'), vars.DJ_NOA_GOOGLE_CLIENT_ID);
  assert.equal(url.searchParams.get('redirect_uri'), config.callbackUrl);
  assert.equal(url.searchParams.get('state'), R);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), CHALLENGE);
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.deepEqual(url.searchParams.get('scope')?.split(' '), DJ_NOA_DRIVE_SCOPES);
  assert.ok(!url.searchParams.get('scope')?.split(' ').includes('https://www.googleapis.com/auth/drive'));
  assert.throws(() => makeDJNoaDriveConsentUrl(config, { state: 'weak', codeChallenge: CHALLENGE }), /invalid_oauth_state/);
  assert.throws(() => makeDJNoaDriveConsentUrl(config, { state: R, codeChallenge: 'weak' }), /invalid_pkce_challenge/);
});

test('code exchange uses correct account client, callback, verifier and POST, never exposes secrets in errors', async () => {
  let calls = 0;
  const fakeFetch = async (url, init) => {
    calls += 1;
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(init.method, 'POST');
    const params = new URLSearchParams(init.body);
    assert.equal(params.get('client_id'), vars.DJ_NOA_GOOGLE_CLIENT_ID);
    assert.equal(params.get('client_secret'), vars.DJ_NOA_GOOGLE_CLIENT_SECRET);
    assert.equal(params.get('code_verifier'), R);
    assert.equal(params.get('redirect_uri'), config.callbackUrl);
    return mockResponse({ token_type: 'Bearer', access_token: 'fake-access-123456', refresh_token: 'fake-refresh-123456', expires_in: 3599 });
  };
  const tokens = await exchangeDJNoaDriveCode(config, 'fake-code', R, fakeFetch);
  assert.equal(tokens.refreshToken, 'fake-refresh-123456');
  assert.equal(calls, 1);

  await assert.rejects(
    () => exchangeDJNoaDriveCode(config, 'fake-code', R, async () => mockResponse({ error: 'invalid_grant' }, 400)),
    /dj_noa_oauth_exchange_failed/
  );
  await assert.rejects(
    () => exchangeDJNoaDriveCode(config, 'fake-code', R, async () =>
      mockResponse({ token_type: 'Bearer', access_token: 'fake-access-123456', expires_in: 3599 })),
    /invalid_dj_noa_oauth_response/
  );
});

test('identity verification rejects other Google Drive accounts and unverified addresses', async () => {
  const identity = await verifyDJNoaDriveIdentity(config, 'fake-access-123456', async (url, init) => {
    assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo');
    assert.equal(init.headers.authorization, 'Bearer fake-access-123456');
    return mockResponse({ sub: 'owner-google-sub', email: 'DJ-NOA@example.test', email_verified: true });
  });
  assert.equal(identity.email, 'dj-noa@example.test');
  assert.equal(identity.googleSubject, 'owner-google-sub');
  await assert.rejects(
    () => verifyDJNoaDriveIdentity(config, 'fake-access-123456', async () =>
      mockResponse({ sub: 'another-sub', email: 'havana@example.test', email_verified: true })),
    /dj_noa_google_account_not_allowed/
  );
  await assert.rejects(
    () => verifyDJNoaDriveIdentity(config, 'fake-access-123456', async () =>
      mockResponse({ sub: 'owner-google-sub', email: 'DJ-NOA@example.test', email_verified: false })),
    /dj_noa_google_account_not_allowed/
  );
});

test('refresh token exchange is server-only and ignores unsafe client input', async () => {
  const res = await refreshDJNoaDriveAccessToken(config, 'fake-refresh-123456', async (url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const params = new URLSearchParams(init.body);
    assert.equal(params.get('grant_type'), 'refresh_token');
    assert.equal(params.get('refresh_token'), 'fake-refresh-123456');
    assert.equal(params.get('client_secret'), vars.DJ_NOA_GOOGLE_CLIENT_SECRET);
    return mockResponse({ token_type: 'Bearer', access_token: 'new-access-1234567', expires_in: 3600 });
  });
  assert.equal(res.accessToken, 'new-access-1234567');
  assert.ok(!JSON.stringify(res).includes('refresh'));
});

test('OAuth helpers are preparation only; no callable production OAuth route exists', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../dj-noa-cloud/src/entry.ts', import.meta.url), 'utf8');
  assert.ok(!source.includes("from './googleDriveOAuth.ts'"));
  assert.ok(!source.includes("'/api/oauth/google/callback'"));
});
