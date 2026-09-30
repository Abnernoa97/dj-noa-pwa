import { useEffect, useRef, useState } from 'react';
import type { RecognitionLike } from './recognitionTypes';
import { getRecognitionCtor, transcriptFromEvent, WAKE_WORD } from './transcript';

const WAKE_RESTART_MS = 700;

type Options = {
  isBlocked: () => boolean;
  onWake: (remainder: string) => void;
};

export function useWakeWord(options: Options) {
  const [listening, setListening] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mountedRef = useRef(true);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const runningRef = useRef(false);
  const suspendedRef = useRef(false);
  const deniedRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);

  const clearRestart = () => {
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  };

  const start = () => {
    const recognition = recognitionRef.current;
    if (!mountedRef.current || !recognition || suspendedRef.current || deniedRef.current || runningRef.current) return;
    if (optionsRef.current.isBlocked() || document.visibilityState !== 'visible') return;
    try {
      recognition.start();
      runningRef.current = true;
      setListening(true);
    } catch {
      // Chromium may reject a restart while a previous session is still closing.
    }
  };

  const schedule = (delay = WAKE_RESTART_MS) => {
    clearRestart();
    if (!mountedRef.current || suspendedRef.current || deniedRef.current) return;
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      start();
    }, delay);
  };

  const suspend = () => {
    suspendedRef.current = true;
    clearRestart();
    setListening(false);
    if (runningRef.current) {
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
    }
    runningRef.current = false;
  };

  const resume = () => {
    suspendedRef.current = false;
    schedule();
  };

  useEffect(() => {
    mountedRef.current = true;
    const Ctor = getRecognitionCtor();
    if (Ctor) {
      const recognition = new Ctor();
      recognition.lang = 'es-MX';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const transcript = transcriptFromEvent(event);
        const match = transcript.match(WAKE_WORD);
        if (!match) return;
        const end = (match.index || 0) + match[0].length;
        const remainder = transcript.slice(end).replace(/^[\s,.:;!?-]+/, '').trim();
        suspend();
        optionsRef.current.onWake(remainder);
      };
      recognition.onend = () => {
        runningRef.current = false;
        setListening(false);
        if (!suspendedRef.current) schedule();
      };
      recognition.onerror = (event) => {
        runningRef.current = false;
        setListening(false);
        const error = String(event.error || '');
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          deniedRef.current = true;
          return;
        }
        if (!suspendedRef.current) schedule(1200);
      };
      recognitionRef.current = recognition;
      schedule(900);
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule(350);
      else {
        setListening(false);
        try { recognitionRef.current?.abort(); } catch { /* noop */ }
        runningRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      clearRestart();
      suspendedRef.current = true;
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { listening, suspend, resume };
}
