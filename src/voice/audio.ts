export const SILENCE_AFTER_VOICE_MS = 3000;
export const NO_VOICE_TIMEOUT_MS = 10000;
export const MAX_WAKE_UTTERANCE_MS = 45000;
export const VOICE_THRESHOLD = 0.018;

export function recorderMimeType() {
  if (!('MediaRecorder' in window)) return '';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return '';
}

export function analyserRms(analyser: AnalyserNode) {
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) {
    const value = (sample - 128) / 128;
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

export async function transcribeAudio(blob: Blob) {
  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'content-type': blob.type || 'audio/webm' },
    body: blob
  });
  if (!response.ok) throw new Error('transcription_unavailable');
  const payload = await response.json() as { text?: string };
  return String(payload.text || '').trim();
}

export function preferredSpanishVoice() {
  if (!('speechSynthesis' in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase() === 'es-mx')
    || voices.find((voice) => voice.lang.toLowerCase().startsWith('es'));
}
