import type { RecognitionCtor, RecognitionEventLike } from './recognitionTypes';

export const WAKE_WORD = /\b(?:dj|deejay|d\s*j|diyei)\s*(?:noa|noah|no\s*a)\b/i;

export function getRecognitionCtor(): RecognitionCtor | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function transcriptFromEvent(event: RecognitionEventLike) {
  const pieces: string[] = [];
  for (let index = 0; index < event.results.length; index += 1) {
    const piece = event.results[index]?.[0]?.transcript?.trim();
    if (piece) pieces.push(piece);
  }
  return pieces.join(' ').trim();
}

export function mergeTranscripts(prefix: string, captured: string) {
  const left = prefix.trim();
  const right = captured.trim();
  if (!left) return right;
  if (!right) return left;

  const a = left.split(/\s+/);
  const b = right.split(/\s+/);
  const max = Math.min(8, a.length, b.length);
  let overlap = 0;
  for (let size = max; size >= 1; size -= 1) {
    const tail = a.slice(-size).join(' ').toLocaleLowerCase('es');
    const head = b.slice(0, size).join(' ').toLocaleLowerCase('es');
    if (tail === head) {
      overlap = size;
      break;
    }
  }
  return [...a, ...b.slice(overlap)].join(' ').trim();
}
