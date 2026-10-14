/**
 * DJ NOA CLOUD — independent namespaces.
 * These constants are deliberately NOT the DJ NOA app's existing Dexie database.
 * Do not import identifiers or tokens from any other cloud service.
 */
export const DJ_NOA_CLOUD_SERVICE = 'dj-noa-cloud-private' as const;
export const DJ_NOA_CLOUD_VERSION = 1 as const;
export const DJ_NOA_CLOUD_LOCAL_DB = 'dj-noa-cloud-offline-g1' as const;
export const DJ_NOA_CLOUD_MEDIA_CACHE = 'dj-noa-cloud-media-g1' as const;
export const DJ_NOA_CLOUD_REMOTE_PREFIX = 'dncloud:g1:' as const;

const MAX_ID_LENGTH = 200;

function validId(id: string): boolean {
  return id.length > 0 && id.length <= MAX_ID_LENGTH &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && !id.includes('..');
}

/** Return a namespaced key, never a raw account or file identifier. */
export function makeDJNoaCloudKey(accountId: string, fileId: string): string {
  if (!validId(accountId) || !validId(fileId)) throw Error('invalid_cloud_id');
  return `${DJ_NOA_CLOUD_REMOTE_PREFIX}${accountId}/${fileId}`;
}

/** Refuse keys without DJ NOA's own namespace, even if they resemble Drive ids. */
export function isDJNoaCloudKey(key: string): boolean {
  if (!key.startsWith(DJ_NOA_CLOUD_REMOTE_PREFIX)) return false;
  const remainder = key.slice(DJ_NOA_CLOUD_REMOTE_PREFIX.length);
  const parts = remainder.split('/');
  return parts.length === 2 && validId(parts[0]) && validId(parts[1]);
}
