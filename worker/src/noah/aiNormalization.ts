/** One accent-removal algorithm, two intentional text policies.
 * Chat accepts dollar signs in money; image matching uses only letters/numbers.
 */
function normalizeCore(value: string, keepDollar: boolean): string {
  return value.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(keepDollar ? /[^a-z0-9$]+/g : /[^a-z0-9]+/g, ' ')
    .trim();
}
export function normalizeChatText(value: string): string {
  return normalizeCore(value, true);
}
export function normalizeVisionText(value: unknown): string {
  return normalizeCore(String(value || ''), false);
}
