/** Sports context and live share identical text normalization and lexical ISO-day extraction. */
export function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function dateOnly(value: string) { return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''; }

