import { useEffect, useRef, useState } from 'react';

type RecognitionResultLike = {
  0: { transcript: string };
  isFinal?: boolean;
};

type RecognitionEventLike = Event & {
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

type CaptureMode = 'manual' | 'wake';
type VoiceMode = 'idle' | 'manual' | 'wake' | 'processing' | 'speaking';

// Wake-command mode keeps the proven automatic flow: once “DJ NOA” is heard,
// the command ends after 3 seconds of silence. Manual mode NEVER uses this timer;
// it records until the user taps the same voice button again.
const SILENCE_AFTER_VOICE_MS = 3000;
const NO_VOICE_TIMEOUT_MS = 10000;
const MAX_WAKE_UTTERANCE_MS = 45000;
const VOICE_THRESHOLD = 0.018;
const WAKE_RESTART_MS = 700;
const WAKE_WORD = /\b(?:dj|deejay|d\s*j|diyei)\s*(?:noa|noah|no\s*a)\b/i;

function getRecognitionCtor(): RecognitionCtor | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

function transcriptFromEvent(event: RecognitionEventLike) {
  const pieces: string[] = [];
  for (let index = 0; index < event.results.length; index += 1) {
    const piece = event.results[index]?.[0]?.transcript?.trim();
    if (piece) pieces.push(piece);
  }
  return pieces.join(' ').trim();
}

function mergeTranscripts(prefix: string, captured: string) {
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

export function useDjNoaVoice(options: Options) {
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [manualRecording, setManualRecording] = useState(false);
  const [wakeListening, setWakeListening] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('idle');

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mountedRef = useRef(true);
  const activeRef = useRef(false);
  const listeningRef = useRef(false);
  const processingRef = useRef(false);
  const speakingRef = useRef(false);
  const modeRef = useRef<VoiceMode>('idle');
  const captureModeRef = useRef<CaptureMode | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const captureStartedAtRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const speechSeenRef = useRef(false);
  const audioSpeechSeenRef = useRef(false);
  const stoppingRef = useRef(false);
  const discardRef = useRef(false);
  const wakePrefixRef = useRef('');

  const wakeRecognitionRef = useRef<RecognitionLike | null>(null);
  const wakeRecognitionRunningRef = useRef(false);
  const wakeSuspendedRef = useRef(false);
  const wakeDeniedRef = useRef(false);
  const wakeRestartTimerRef = useRef<number | null>(null);

  const fallbackRecognitionRef = useRef<RecognitionLike | null>(null);
  const fallbackModeRef = useRef<CaptureMode | null>(null);
  const fallbackTextRef = useRef('');
  const fallbackPrefixRef = useRef('');
  const fallbackManualStopRef = useRef(false);

  const setVoiceMode = (next: VoiceMode) => {
    modeRef.current = next;
    setMode(next);
  };

  const stopMeter = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    analyserRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  };

  const releaseMicrophone = () => {
    stopMeter();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearWakeRestart = () => {
    if (wakeRestartTimerRef.current !== null) window.clearTimeout(wakeRestartTimerRef.current);
    wakeRestartTimerRef.current = null;
  };

  const startWakeRecognition = () => {
    const recognition = wakeRecognitionRef.current;
    if (!mountedRef.current || !recognition || wakeSuspendedRef.current || wakeDeniedRef.current || wakeRecognitionRunningRef.current) return;
    if (activeRef.current || processingRef.current || speakingRef.current || document.visibilityState !== 'visible') return;
    try {
      recognition.start();
      wakeRecognitionRunningRef.current = true;
      setWakeListening(true);
    } catch {
      // Chromium can briefly reject a restart while the previous session is closing.
    }
  };

  const scheduleWakeRecognition = (delay = WAKE_RESTART_MS) => {
    clearWakeRestart();
    if (!mountedRef.current || wakeSuspendedRef.current || wakeDeniedRef.current) return;
    wakeRestartTimerRef.current = window.setTimeout(() => {
      wakeRestartTimerRef.current = null;
      startWakeRecognition();
    }, delay);
  };

  const suspendWakeRecognition = () => {
    wakeSuspendedRef.current = true;
    clearWakeRestart();
    setWakeListening(false);
    if (wakeRecognitionRunningRef.current) {
      try { wakeRecognitionRef.current?.abort(); } catch { /* noop */ }
    }
    wakeRecognitionRunningRef.current = false;
  };

  const resumeWakeRecognition = () => {
    wakeSuspendedRef.current = false;
    scheduleWakeRecognition();
  };

  const finishSession = () => {
    activeRef.current = false;
    listeningRef.current = false;
    processingRef.current = false;
    speakingRef.current = false;
    captureModeRef.current = null;
    setActive(false);
    setListening(false);
    setManualRecording(false);
    setVoiceMode('idle');
    releaseMicrophone();
    resumeWakeRecognition();
  };

  const stopRecorder = (discard = false) => {
    if (stoppingRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (discard) discardRef.current = true;
    stoppingRef.current = true;
    try { recorder.stop(); } catch { stoppingRef.current = false; }
  };

  const stopSession = (status?: string) => {
    discardRef.current = true;
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    try { fallbackRecognitionRef.current?.abort(); } catch { /* noop */ }
    window.speechSynthesis?.cancel();
    finishSession();
    if (status) optionsRef.current.onStatus(status);
  };

  const speakOnce = (text: string) => {
    releaseMicrophone();
    if (!('speechSynthesis' in window) || !text.trim()) {
      finishSession();
      return;
    }

    speakingRef.current = true;
    setVoiceMode('speaking');
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 1.06;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => voice.lang.toLowerCase() === 'es-mx')
      || voices.find((voice) => voice.lang.toLowerCase().startsWith('es'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = finishSession;
    utterance.onerror = finishSession;
    window.speechSynthesis.speak(utterance);
  };

  const transcribe = async (blob: Blob) => {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'content-type': blob.type || 'audio/webm' },
      body: blob
    });
    if (!response.ok) throw new Error('transcription_unavailable');
    const payload = await response.json() as { text?: string };
    return String(payload.text || '').trim();
  };

  const processText = async (text: string) => {
    if (!text.trim()) {
      optionsRef.current.onStatus('No escuché una frase. Toca el botón cuando quieras intentarlo otra vez.');
      finishSession();
      return;
    }

    optionsRef.current.onLiveText(text);
    optionsRef.current.onStatus('…');
    processingRef.current = true;
    setVoiceMode('processing');
    try {
      const reply = await optionsRef.current.onCommand(text);
      processingRef.current = false;
      if (reply) speakOnce(reply);
      else finishSession();
    } catch {
      processingRef.current = false;
      optionsRef.current.onStatus('No pude completar la orden. Inténtalo otra vez cuando quieras.');
      finishSession();
    }
  };

  const processRecording = async (blob: Blob, prefix = '', shouldTranscribe = true) => {
    processingRef.current = true;
    setVoiceMode('processing');
    setManualRecording(false);
    optionsRef.current.onStatus('Entendiendo…');
    try {
      const captured = shouldTranscribe && blob.size ? await transcribe(blob) : '';
      processingRef.current = false;
      await processText(mergeTranscripts(prefix, captured));
    } catch {
      processingRef.current = false;
      if (prefix.trim()) {
        await processText(prefix);
        return;
      }
      optionsRef.current.onStatus(navigator.onLine
        ? 'No pude procesar el audio. Toca el botón para intentarlo otra vez.'
        : 'Estoy sin internet. Para entender la voz necesito conexión.');
      finishSession();
    }
  };

  const monitorWakeCommand = () => {
    const analyser = analyserRef.current;
    const recorder = recorderRef.current;
    if (!analyser || !recorder || recorder.state === 'inactive' || captureModeRef.current !== 'wake') return;

    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const value = (sample - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / samples.length);
    const now = performance.now();

    if (rms >= VOICE_THRESHOLD) {
      speechSeenRef.current = true;
      audioSpeechSeenRef.current = true;
      lastVoiceAtRef.current = now;
    }

    const elapsed = now - captureStartedAtRef.current;
    if (speechSeenRef.current && now - lastVoiceAtRef.current >= SILENCE_AFTER_VOICE_MS) {
      stopRecorder();
      return;
    }
    if (!speechSeenRef.current && elapsed >= NO_VOICE_TIMEOUT_MS) {
      stopRecorder();
      return;
    }
    if (elapsed >= MAX_WAKE_UTTERANCE_MS) {
      stopRecorder();
      return;
    }
    frameRef.current = requestAnimationFrame(monitorWakeCommand);
  };

  async function getStream() {
    const current = streamRef.current;
    if (current?.getAudioTracks().some((track) => track.readyState === 'live')) return current;
    if (!navigator.mediaDevices?.getUserMedia) return null;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    wakeDeniedRef.current = false;
    streamRef.current = stream;
    return stream;
  }

  async function startCapture(captureMode: CaptureMode, prefix = '') {
    if (!activeRef.current || processingRef.current || speakingRef.current || listeningRef.current) return;

    if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) {
      startRecognitionFallback(captureMode, prefix);
      return;
    }

    try {
      const stream = await getStream();
      if (!stream || !activeRef.current) return;

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      captureModeRef.current = captureMode;
      chunksRef.current = [];
      wakePrefixRef.current = prefix;
      speechSeenRef.current = captureMode === 'wake' && Boolean(prefix.trim());
      audioSpeechSeenRef.current = false;
      stoppingRef.current = false;
      discardRef.current = false;
      captureStartedAtRef.current = performance.now();
      lastVoiceAtRef.current = captureStartedAtRef.current;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stopMeter();
        const finishedMode = captureModeRef.current;
        const prefixText = wakePrefixRef.current;
        const heardAudioSpeech = audioSpeechSeenRef.current;
        recorderRef.current = null;
        captureModeRef.current = null;
        stoppingRef.current = false;
        listeningRef.current = false;
        setListening(false);
        setManualRecording(false);
        releaseMicrophone();

        const shouldDiscard = discardRef.current;
        discardRef.current = false;
        const hadSpeech = speechSeenRef.current;
        const chunks = chunksRef.current;
        chunksRef.current = [];
        wakePrefixRef.current = '';

        if (shouldDiscard || !activeRef.current) return;
        if (finishedMode === 'wake' && !hadSpeech) {
          optionsRef.current.onStatus('No escuché el comando después de DJ NOA.');
          finishSession();
          return;
        }
        if (!chunks.length && !prefixText.trim()) {
          optionsRef.current.onStatus('No escuché nada. Toca el botón cuando quieras hablarme.');
          finishSession();
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const shouldTranscribe = finishedMode === 'manual' || heardAudioSpeech;
        void processRecording(blob, prefixText, shouldTranscribe);
      };

      recorder.onerror = () => {
        optionsRef.current.onStatus('Hubo un problema con el micrófono. Toca el botón para volver a intentarlo.');
        finishSession();
      };

      recorder.start(250);
      listeningRef.current = true;
      setListening(true);

      if (captureMode === 'manual') {
        setManualRecording(true);
        setVoiceMode('manual');
        optionsRef.current.onStatus('Grabando… puedes pausar todo lo que quieras. Toca el botón otra vez para enviar.');
        return;
      }

      setVoiceMode('wake');
      optionsRef.current.onStatus('DJ NOA · Te escucho…');
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      frameRef.current = requestAnimationFrame(monitorWakeCommand);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      optionsRef.current.onStatus(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Necesito permiso para usar el micrófono. Permítelo para DJ NOA y vuelve a tocar el botón.'
          : 'No pude abrir el micrófono en este navegador.'
      );
      finishSession();
    }
  }

  async function beginWakeCommand(prefix = '') {
    if (activeRef.current || processingRef.current || speakingRef.current) return;
    suspendWakeRecognition();
    optionsRef.current.onOpen();
    activeRef.current = true;
    setActive(true);
    setVoiceMode('wake');
    optionsRef.current.onStatus('DJ NOA · Te escucho…');
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    await startCapture('wake', prefix);
  }

  function startRecognitionFallback(captureMode: CaptureMode, prefix = '') {
    const recognition = fallbackRecognitionRef.current;
    if (!recognition || listeningRef.current) {
      if (!recognition) {
        optionsRef.current.onStatus('Este navegador no ofrece entrada de voz. Puedes escribirme el comando.');
        finishSession();
      }
      return;
    }

    fallbackModeRef.current = captureMode;
    fallbackPrefixRef.current = prefix;
    fallbackTextRef.current = '';
    fallbackManualStopRef.current = false;
    recognition.continuous = captureMode === 'manual';
    recognition.interimResults = true;

    try {
      recognition.start();
      listeningRef.current = true;
      setListening(true);
      if (captureMode === 'manual') {
        setManualRecording(true);
        setVoiceMode('manual');
        optionsRef.current.onStatus('Grabando… toca el botón otra vez para enviar.');
      } else {
        setVoiceMode('wake');
        optionsRef.current.onStatus('DJ NOA · Te escucho…');
      }
    } catch {
      optionsRef.current.onStatus('No pude iniciar el micrófono. Toca el botón para intentarlo otra vez.');
      finishSession();
    }
  }

  const toggle = async () => {
    optionsRef.current.onOpen();

    if (modeRef.current === 'manual' && listeningRef.current) {
      optionsRef.current.onStatus('Enviando…');
      if (recorderRef.current) {
        stopRecorder();
      } else if (fallbackRecognitionRef.current) {
        fallbackManualStopRef.current = true;
        try { fallbackRecognitionRef.current.stop(); } catch { /* noop */ }
      }
      return;
    }

    if (modeRef.current === 'wake' && listeningRef.current) {
      optionsRef.current.onStatus('Enviando…');
      if (recorderRef.current) stopRecorder();
      else {
        try { fallbackRecognitionRef.current?.stop(); } catch { /* noop */ }
      }
      return;
    }

    if (activeRef.current) {
      stopSession('Voz pausada.');
      return;
    }

    suspendWakeRecognition();
    activeRef.current = true;
    setActive(true);
    setVoiceMode('manual');
    optionsRef.current.onStatus('Preparando micrófono…');
    await startCapture('manual');
  };

  useEffect(() => {
    mountedRef.current = true;
    const Ctor = getRecognitionCtor();
    if (Ctor) {
      const wakeRecognition = new Ctor();
      wakeRecognition.lang = 'es-MX';
      wakeRecognition.continuous = true;
      wakeRecognition.interimResults = true;
      wakeRecognition.onresult = (event) => {
        const transcript = transcriptFromEvent(event);
        const match = transcript.match(WAKE_WORD);
        if (!match) return;
        const end = (match.index || 0) + match[0].length;
        const remainder = transcript.slice(end).replace(/^[\s,.:;!?-]+/, '').trim();
        wakeSuspendedRef.current = true;
        setWakeListening(false);
        try { wakeRecognition.abort(); } catch { /* noop */ }
        wakeRecognitionRunningRef.current = false;
        void beginWakeCommand(remainder);
      };
      wakeRecognition.onend = () => {
        wakeRecognitionRunningRef.current = false;
        setWakeListening(false);
        if (!wakeSuspendedRef.current) scheduleWakeRecognition();
      };
      wakeRecognition.onerror = (event) => {
        wakeRecognitionRunningRef.current = false;
        setWakeListening(false);
        const error = String(event.error || '');
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          wakeDeniedRef.current = true;
          return;
        }
        if (!wakeSuspendedRef.current) scheduleWakeRecognition(1200);
      };
      wakeRecognitionRef.current = wakeRecognition;

      const fallbackRecognition = new Ctor();
      fallbackRecognition.lang = 'es-MX';
      fallbackRecognition.continuous = false;
      fallbackRecognition.interimResults = true;
      fallbackRecognition.onresult = (event) => {
        const text = transcriptFromEvent(event);
        if (!text) return;
        fallbackTextRef.current = text;
        if (fallbackModeRef.current === 'manual') optionsRef.current.onLiveText(text);
        if (fallbackModeRef.current === 'wake') {
          listeningRef.current = false;
          setListening(false);
          try { fallbackRecognition.stop(); } catch { /* noop */ }
        }
      };
      fallbackRecognition.onend = () => {
        const finishedMode = fallbackModeRef.current;
        const text = mergeTranscripts(fallbackPrefixRef.current, fallbackTextRef.current);
        listeningRef.current = false;
        setListening(false);
        setManualRecording(false);

        if (!activeRef.current || !finishedMode) return;
        if (finishedMode === 'manual' && !fallbackManualStopRef.current) {
          // Some browsers end continuous recognition after a pause. Keep manual mode
          // open and restart it until the user explicitly presses STOP/ENVIAR.
          window.setTimeout(() => {
            if (activeRef.current && modeRef.current === 'manual' && !fallbackManualStopRef.current) {
              try {
                fallbackRecognition.start();
                listeningRef.current = true;
                setListening(true);
                setManualRecording(true);
              } catch { /* noop */ }
            }
          }, 180);
          return;
        }
        fallbackModeRef.current = null;
        fallbackPrefixRef.current = '';
        fallbackManualStopRef.current = false;
        void processText(text);
      };
      fallbackRecognition.onerror = (event) => {
        const error = String(event.error || '');
        if (fallbackModeRef.current === 'manual' && error === 'no-speech' && !fallbackManualStopRef.current) return;
        optionsRef.current.onStatus(
          error === 'not-allowed' || error === 'service-not-allowed'
            ? 'Necesito permiso para usar el micrófono.'
            : 'No pude escuchar la frase. Toca el botón para intentarlo otra vez.'
        );
        finishSession();
      };
      fallbackRecognitionRef.current = fallbackRecognition;

      scheduleWakeRecognition(900);
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleWakeRecognition(350);
      else {
        setWakeListening(false);
        try { wakeRecognitionRef.current?.abort(); } catch { /* noop */ }
        wakeRecognitionRunningRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      clearWakeRestart();
      wakeSuspendedRef.current = true;
      discardRef.current = true;
      try { recorderRef.current?.stop(); } catch { /* noop */ }
      try { wakeRecognitionRef.current?.abort(); } catch { /* noop */ }
      try { fallbackRecognitionRef.current?.abort(); } catch { /* noop */ }
      window.speechSynthesis?.cancel();
      releaseMicrophone();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { active, listening, manualRecording, wakeListening, mode, toggle };
}
