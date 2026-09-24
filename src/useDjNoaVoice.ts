import { useEffect, useRef, useState } from 'react';

type RecognitionResultLike = {
  0: { transcript: string };
  isFinal?: boolean;
};

type RecognitionEventLike = Event & {
  resultIndex?: number;
  results: ArrayLike<RecognitionResultLike>;
};

type RecognitionErrorLike = Event & { error?: string };

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => RecognitionLike;

type Options = {
  onCommand: (text: string) => Promise<string | undefined>;
  onOpen: () => void;
  onLiveText: (text: string) => void;
  onStatus: (text: string) => void;
};

const RESTART_DELAY_MS = 140;
const AFTER_SPEECH_DELAY_MS = 180;
const FINAL_SILENCE_MS = 760;
const INTERIM_SILENCE_MS = 1180;

function getRecognitionCtor(): RecognitionCtor | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function useDjNoaVoice(options: Options) {
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const activeRef = useRef(false);
  const listeningRef = useRef(false);
  const processingRef = useRef(false);
  const speakingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const finalPartsRef = useRef<string[]>([]);
  const interimRef = useRef('');

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  };

  const startRecognition = () => {
    if (!activeRef.current || processingRef.current || speakingRef.current || listeningRef.current) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.start();
      listeningRef.current = true;
      setListening(true);
    } catch {
      // Android Chrome can throw briefly while the previous session is closing.
    }
  };

  const scheduleRestart = (delay = RESTART_DELAY_MS) => {
    if (!activeRef.current || processingRef.current || speakingRef.current) return;
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = window.setTimeout(startRecognition, delay);
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window) || !text.trim()) {
      scheduleRestart(AFTER_SPEECH_DELAY_MS);
      return;
    }

    speakingRef.current = true;
    clearSilenceTimer();
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 1.06;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => voice.lang.toLowerCase() === 'es-mx')
      || voices.find((voice) => voice.lang.toLowerCase().startsWith('es'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      speakingRef.current = false;
      scheduleRestart(AFTER_SPEECH_DELAY_MS);
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      scheduleRestart(AFTER_SPEECH_DELAY_MS);
    };
    window.speechSynthesis.speak(utterance);
  };

  const flushUtterance = () => {
    clearSilenceTimer();
    if (processingRef.current || speakingRef.current) return;
    const text = [...finalPartsRef.current, interimRef.current]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    finalPartsRef.current = [];
    interimRef.current = '';
    if (!text) return;

    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    processingRef.current = true;
    optionsRef.current.onLiveText(text);
    optionsRef.current.onOpen();
    optionsRef.current.onStatus('…');

    void optionsRef.current.onCommand(text)
      .then((reply) => {
        if (reply) speak(reply);
        else scheduleRestart(AFTER_SPEECH_DELAY_MS);
      })
      .catch(() => {
        optionsRef.current.onStatus('No pude completar la orden. Inténtalo otra vez.');
        scheduleRestart(300);
      })
      .finally(() => {
        processingRef.current = false;
      });
  };

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      if (processingRef.current || speakingRef.current) return;
      const start = typeof event.resultIndex === 'number'
        ? event.resultIndex
        : Math.max(0, event.results.length - 1);
      let interim = '';
      let receivedFinal = false;

      for (let index = start; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) {
          finalPartsRef.current.push(text);
          receivedFinal = true;
        } else {
          interim = `${interim} ${text}`.trim();
        }
      }

      interimRef.current = interim;
      const liveText = [...finalPartsRef.current, interim]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (liveText) {
        optionsRef.current.onLiveText(liveText);
        optionsRef.current.onOpen();
        optionsRef.current.onStatus('Te escucho…');
      }

      clearSilenceTimer();
      silenceTimerRef.current = window.setTimeout(
        flushUtterance,
        receivedFinal ? FINAL_SILENCE_MS : INTERIM_SILENCE_MS
      );
    };

    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
      if (!processingRef.current && !speakingRef.current) scheduleRestart();
    };

    recognition.onerror = (event) => {
      listeningRef.current = false;
      setListening(false);
      const error = String(event.error || '');
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        activeRef.current = false;
        setActive(false);
        optionsRef.current.onOpen();
        optionsRef.current.onStatus('Necesito permiso para usar el micrófono. Actívalo para DJ NOA y vuelve a intentarlo.');
        return;
      }
      // no-speech / aborted / network can happen transiently on Android.
      // ZUNZUN does not turn those into a visible failure; it simply retries.
      if (!processingRef.current && !speakingRef.current) scheduleRestart(240);
    };

    recognitionRef.current = recognition;

    return () => {
      activeRef.current = false;
      clearSilenceTimer();
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      try { recognition.abort(); } catch { /* noop */ }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const toggle = () => {
    const supported = Boolean(getRecognitionCtor());
    optionsRef.current.onOpen();
    if (!supported) {
      optionsRef.current.onStatus('Este navegador no ofrece reconocimiento de voz. Puedes escribirme el comando.');
      return;
    }

    if (activeRef.current && speakingRef.current) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
      optionsRef.current.onStatus('Te escucho.');
      scheduleRestart(40);
      return;
    }

    const next = !activeRef.current;
    activeRef.current = next;
    setActive(next);

    if (next) {
      finalPartsRef.current = [];
      interimRef.current = '';
      optionsRef.current.onStatus('Te escucho.');
      startRecognition();
    } else {
      clearSilenceTimer();
      finalPartsRef.current = [];
      interimRef.current = '';
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      listeningRef.current = false;
      setListening(false);
      optionsRef.current.onStatus('Voz pausada.');
    }
  };

  return { active, listening, toggle };
}
