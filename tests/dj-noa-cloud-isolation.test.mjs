import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DJ_NOA_CLOUD_LOCAL_DB, DJ_NOA_CLOUD_MEDIA_CACHE,
  DJ_NOA_CLOUD_REMOTE_PREFIX, DJ_NOA_CLOUD_SERVICE,
  isDJNoaCloudKey, makeDJNoaCloudKey
} from '../dj-noa-cloud/src/identity.ts';
import { planDJNoaCloudSync } from '../dj-noa-cloud/src/syncContract.ts';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('cloud names are isolated from the two established applications', () => {
  const cloud = JSON.parse(source('dj-noa-cloud/wrangler.jsonc'));
  const app = JSON.parse(source('wrangler.jsonc'));
  assert.equal(cloud.name, DJ_NOA_CLOUD_SERVICE);
  assert.notEqual(cloud.name, app.name);
  assert.notEqual(cloud.durable_objects.bindings[0].name, app.durable_objects.bindings[0].name);
  assert.equal(cloud.workers_dev, false);
  assert.equal(cloud.main, 'src/entry.ts');
  assert.notEqual(DJ_NOA_CLOUD_LOCAL_DB, 'dj-noa-local');
  assert.notEqual(DJ_NOA_CLOUD_LOCAL_DB, 'hn-cloud-private-offline-v1');
  assert.notEqual(DJ_NOA_CLOUD_MEDIA_CACHE, 'hn-cloud-private-photos-v1');
});

test('sharing DJ NOA Cloudflare account never grants cross-project data bindings', () => {
  const cloud = JSON.parse(source('dj-noa-cloud/wrangler.jsonc'));
  const dj = JSON.parse(source('wrangler.jsonc'));
  const provisioning = source('dj-noa-cloud/PROVISIONING.md');
  assert.notEqual(cloud.name, dj.name);
  assert.equal(cloud.durable_objects.bindings.length, 1);
  assert.equal(cloud.durable_objects.bindings[0].name, 'DJ_NOA_CLOUD_REGISTRY');
  assert.equal(cloud.durable_objects.bindings[0].class_name, 'DJNoaCloudRegistry');
  assert.ok(!('script_name' in cloud.durable_objects.bindings[0]));
  assert.ok(!('services' in cloud));
  assert.ok(!('kv_namespaces' in cloud));
  assert.ok(!('d1_databases' in cloud));
  assert.ok(!('r2_buckets' in cloud));
  assert.ok(!('account_id' in cloud), 'Never guess or hardcode a Cloudflare account ID');
  assert.match(provisioning, /account ID de DJ NOA PWA/);
  assert.match(provisioning, /No abrir otra cuenta de Cloudflare/);
  assert.doesNotMatch(JSON.stringify(cloud).toLowerCase(), /havana|hn-cloud/);
});

test('remote media ids cannot cross cloud namespaces or traverse paths', () => {
  const key = makeDJNoaCloudKey('account-1', 'file_2026');
  assert.equal(key, DJ_NOA_CLOUD_REMOTE_PREFIX + 'account-1/file_2026');
  assert.equal(isDJNoaCloudKey(key), true);
  assert.equal(isDJNoaCloudKey('hncloud:account-1/file_2026'), false);
  assert.equal(isDJNoaCloudKey('account-1/file_2026'), false);
  assert.equal(isDJNoaCloudKey('dncloud:g1:../private'), false);
  assert.throws(() => makeDJNoaCloudKey('../other', 'secret'));
  assert.throws(() => makeDJNoaCloudKey('acct', 'nested/path'));
});

test('remote sync refuses foreign ids and does not overwrite competing edits', () => {
  const k = makeDJNoaCloudKey('acct', 'f1');
  const local = { key: k, revision: 'old', modifiedAt: '2026-10-12', deleted: false };
  const remote = { key: k, revision: 'new', modifiedAt: '2026-10-13', deleted: false };
  assert.equal(planDJNoaCloudSync(local, remote, true).kind, 'manual_conflict');
  assert.equal(planDJNoaCloudSync(local, remote, false).kind, 'download_remote');
  assert.equal(planDJNoaCloudSync(local, local, false).kind, 'not_changed');
  assert.equal(planDJNoaCloudSync(null, remote, false).kind, 'download_remote');
  assert.equal(planDJNoaCloudSync(local, null, true).kind, 'upload_local');
  assert.equal(planDJNoaCloudSync(local, null, false).kind, 'manual_conflict');
  assert.equal(planDJNoaCloudSync(local, { ...remote, key: 'foreign:app/f1' }, true).kind, 'reject_foreign_key');
});

test('no cloud endpoints are enabled before secure independent provisioning', () => {
  const worker = source('dj-noa-cloud/src/entry.ts');
  assert.match(worker, /status: 'setup_required'/);
  assert.match(worker, /secureJson\(\{ error: 'not_found' \}, 404\)/);
  assert.doesNotMatch(worker, /['"]\/api\/(?:upload|files|oauth\/google\/callback)['"]/);
  assert.doesNotMatch(worker, /fetch\(\s*['"]https:\/\//);
  assert.doesNotMatch(worker, /APP_ACCESS_PASSWORD|GOOGLE_CLIENT_SECRET\s*[:=]\s*['"][^'"]+/);
});
