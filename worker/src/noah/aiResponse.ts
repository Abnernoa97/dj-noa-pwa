/** Shared Cloudflare AI text extraction and fallback JSON object parsing.
 * Keeps the exact existing model response fallback behavior for chat and vision.
 */
export function readText(result: unknown) {
  const value = result as { response?: string; choices?: Array<{ message?: { content?: string } }> };
  return String(value?.choices?.[0]?.message?.content || value?.response || '').trim();
}

export function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(trimmed.slice(first, last + 1)) as Record<string, unknown>; } catch { return null; }
    }
    return null;
  }
}

