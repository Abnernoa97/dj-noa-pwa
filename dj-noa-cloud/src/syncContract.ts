/**
 * Pure data contract for the future local-first sync engine.
 * Phase 1 only: NO network calls, storage mutation or cross-application import.
 */
import { isDJNoaCloudKey } from './identity.ts';

export type DJNoaCloudRecord = Readonly<{
  key: string;
  revision: string;
  modifiedAt: string;
  deleted: boolean;
}>;

export type SyncDecision =
  | { kind: 'reject_foreign_key' }
  | { kind: 'not_changed' }
  | { kind: 'download_remote'; remote: DJNoaCloudRecord }
  | { kind: 'upload_local'; local: DJNoaCloudRecord }
  | { kind: 'manual_conflict'; local: DJNoaCloudRecord; remote: DJNoaCloudRecord };

/**
 * Equal revisions mean equal remote state. Different local/remote revisions with
 * competing changes are NEVER silently overwritten.
 */
export function planDJNoaCloudSync(
  local: DJNoaCloudRecord | null,
  remote: DJNoaCloudRecord | null,
  localDirty: boolean
): SyncDecision {
  if ((local && !isDJNoaCloudKey(local.key)) || (remote && !isDJNoaCloudKey(remote.key))) {
    return { kind: 'reject_foreign_key' };
  }
  if (local && remote && local.key !== remote.key) return { kind: 'reject_foreign_key' };
  if (!local && !remote) return { kind: 'not_changed' };
  if (!local && remote) return { kind: 'download_remote', remote };
  if (local && !remote) {
    if (localDirty) return { kind: 'upload_local', local };
    // Never guess that absence remotely means safe restoration.
    return { kind: 'manual_conflict', local, remote: local };
  }
  if (!local || !remote) return { kind: 'not_changed' };
  if (local.revision === remote.revision) return { kind: 'not_changed' };
  if (localDirty) return { kind: 'manual_conflict', local, remote };
  return { kind: 'download_remote', remote };
}
