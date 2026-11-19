type ReadOptions = {
  errorMessage?: string;
  preferNativeError?: boolean;
};

/** One FileReader-to-dataURL implementation.
 * AI input keeps file_read_failed; local backup prefers FileReader.error before photo_read_failed.
 */
export function blobToDataUrl(blob: Blob, options: ReadOptions = {}): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(
      (options.preferNativeError && reader.error) || new Error(options.errorMessage || 'file_read_failed')
    );
    reader.readAsDataURL(blob);
  });
}
