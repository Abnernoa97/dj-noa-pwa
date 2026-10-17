/**
 * Advisory preflight only. StorageManager estimates are not a guarantee of
 * physical disk space; the IndexedDB transaction remains authoritative.
 * Never delete or shrink existing user records to make room for imports.
 */
export function hasNoahVisionStorageBudget(
  expectedBytes: number,
  estimate: { usage?: number; quota?: number }
): boolean {
  const { usage, quota } = estimate;
  if (!Number.isFinite(expectedBytes) || expectedBytes < 0) return false;
  if (typeof usage !== 'number' || typeof quota !== 'number' ||
      !Number.isFinite(usage) || !Number.isFinite(quota) ||
      usage < 0 || quota <= 0 || usage > quota) return true;
  const safetyMargin = 8 * 1024 * 1024;
  return quota - usage >= expectedBytes + safetyMargin;
}

export async function assertNoahVisionStorageCapacity(expectedBytes: number): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
  let estimate: StorageEstimate | null = null;
  try {
    estimate = await navigator.storage.estimate();
  } catch {
    // Some WebViews do not expose quotas. In that case rely on the database
    // transaction and surface an error if the write cannot be completed.
    return;
  }
  if (estimate && !hasNoahVisionStorageBudget(expectedBytes, estimate)) {
    throw new Error('vision_storage_low');
  }
}
