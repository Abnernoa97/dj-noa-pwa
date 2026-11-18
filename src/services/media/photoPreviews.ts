/** The sole owner of blob URL preview replacement and release; no file or DB writes. */
export function replacePhotoPreviews<T extends {url: string}, R extends {blob: Blob}>(current: T[], stored: R[]): Array<R & {url: string}> {
  current.forEach((photo) => URL.revokeObjectURL(photo.url));
  return stored.map((photo) => ({ ...photo, url: URL.createObjectURL(photo.blob) }));
}

export function clearPhotoPreviews<T extends {url: string}>(current: T[]): [] {
  current.forEach((photo) => URL.revokeObjectURL(photo.url));
  return [];
}
