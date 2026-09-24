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

// DJ NOA only considers the phrase finished after 3 full seconds
// without detecting new speech. This gives the user room to think,
// correct a date or continue a multi-part instruction naturally.
const SILENCE_AFTER_VOICE_MS = 3000;
const NO_VOICE_TIMEOUT_MS = 10000;
const MAX_UTTERANCE_MS = 45000;
const VOICE_THRESHOLD = 0.018;

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

  const activeRef = useRef(false);
  const listeningRef = useRef(false);
  const processingRef = useRef(false);
  const speakingRef = useRef(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const captureStartedAtRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const speechSeenRef = useRef(false);
  const stoppingRef = useRef(false);
  const discardRef = useRef(false);
  const fallbackGotResultRef = useRef(false);

  const recognitionRef = useRef<RecognitionLike | null>(null);

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

  const setSessionInactive = () => {
    activeRef.current = false;
    listeningRef.current = false;
    processingRef.current = false;
    speakingRef.current = false;
    setActive(false);
    setListening(false);
    releaseMicrophone();
  };

  const stopRecorder = () => {
    if (stoppingRef.current) return;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    stoppingRef.current = true;
    try { recorder.stop(); } catch { stoppingRef.current = false; }
  };

  const stopSession = (status?: string) => {
    discardRef.current = true;
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    window.speechSynthesis?.cancel();
    setSessionInactive();
    if (status) optionsRef.current.onStatus(status);
  };

  const speakOnce = (text: string) => {
    releaseMicrophone();
    if (!('speechSynthesis' in window) || !text.trim()) {
      setSessionInactive();
      return;
    }

    speakingRef.current = true;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-MX';
    utterance.rate = 1.06;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => voice.lang.toLowerCase() === 'es-mx')
      || voices.find((voice) => voice.lang.toLowerCase().startsWith('es'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => setSessionInactive();
    utterance.onerror = () => setSessionInactive();
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
      setSessionInactive();
      return;
    }

    optionsRef.current.onLiveText(text);
    optionsRef.current.onStatus('…');
    processingRef.current = true;
    try {
      const reply = await optionsRef.current.onCommand(text);
      processingRef.current = false;
      if (reply) speakOnce(reply);
      else setSessionInactive();
    } catch {
      processingRef.current = false;
      optionsRef.current.onStatus('No pude completar la orden. Inténtalo otra vez cuando quieras.');
      setSessionInactive();
    }
  };

  const processRecording = async (blob: Blob) => {
    processingRef.current = true;
    optionsRef.current.onStatus('Entendiendo…');
    try {
      const text = await transcribe(blob);
      processingRef.current = false;
      await processText(text);
    } catch {
      processingRef.current = false;
      optionsRef.current.onStatus(navigator.onLine
        ? 'No pude procesar el audio. Toca el botón para intentarlo otra vez.'
        : 'Estoy sin internet. Para entender la voz necesito conexión.');
      setSessionInactive();
    }
  };

  const monitorVoice = () => {
    const analyser = analyserRef.current;
    const recorder = recorderRef.current;
    if (!analyser || !recorder || recorder.state === 'inactive') return;

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
    if (elapsed >= MAX_UTTERANCE_MS) {
      stopRecorder();
      return;
    }
    frameRef.current = requestAnimationFrame(monitorVoice);
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
    streamRef.current = stream;
    return stream;
  }

  async function startCapture() {
    if (!activeRef.current || processingRef.current || speakingRef.current || listeningRef.current) return;

    if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) {
      startRecognitionFallback();
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
      chunksRef.current = [];
      speechSeenRef.current = false;
      stoppingRef.current = false;
      discardRef.current = false;
      captureStartedAtRef.current = performance.now();
      lastVoiceAtRef.current = captureStartedAtRef.current;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stopMeter();
        recorderRef.current = null;
        stoppingRef.current = false;
        listeningRef.current = false;
        setListening(false);
        releaseMicrophone();

        const shouldDiscard = discardRef.current;
        discardRef.current = false;
        const hadSpeech = speechSeenRef.current;
        const chunks = chunksRef.current;
        chunksRef.current = [];

        if (shouldDiscard || !activeRef.current) return;
        if (!hadSpeech || !chunks.length) {
          optionsRef.current.onStatus('No escuché nada. Toca el botón cuando quieras hablarme.');
          setSessionInactive();
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        void processRecording(blob);
      };

      recorder.onerror = () => {
        optionsRef.current.onStatus('Hubo un problema con el micrófono. Toca el botón para volver a intentarlo.');
        setSessionInactive();
      };

      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;

      recorder.start(250);
      listeningRef.current = true;
      setListening(true);
      optionsRef.current.onStatus('Te escucho…');
      frameRef.current = requestAnimationFrame(monitorVoice);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      optionsRef.current.onStatus(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Necesito permiso para usar el micrófono. Permítelo para DJ NOA y vuelve a tocar el botón.'
          : 'No pude abrir el micrófono en este navegador.'
      );
      setSessionInactive();
    }
  }

  function startRecognitionFallback() {
    const recognition = recognitionRef.current;
    if (!recognition || !activeRef.current || listeningRef.current) {
      if (!recognition) {
        optionsRef.current.onStatus('Este navegador no ofrece entrada de voz. Puedes escribirme el comando.');
        setSessionInactive();
      }
      return;
    }
    fallbackGotResultRef.current = false;
    try {
      recognition.start();
      listeningRef.current = true;
      setListening(true);
      optionsRef.current.onStatus('Te escucho…');
    } catch {
      optionsRef.current.onStatus('No pude iniciar el micrófono. Toca el botón para intentarlo otra vez.');
      setSessionInactive();
    }
  }

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (Ctor) {
      const recognition = new Ctor();
      recognition.lang = 'es-MX';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const text = event.results?.[0]?.[0]?.transcript?.trim() || '';
        fallbackGotResultRef.current = Boolean(text);
        listeningRef.current = false;
        setListening(false);
        if (text) void processText(text);
      };

      recognition.onend = () => {
        listeningRef.current = false;
        setListening(false);
        if (activeRef.current && !processingRef.current && !speakingRef.current && !fallbackGotResultRef.current) {
          optionsRef.current.onStatus('No escuché nada. Toca el botón cuando quieras hablarme.');
          setSessionInactive();
        }
      };

      recognition.onerror = (event) => {
        listeningRef.current = false;
        setListening(false);
        const error = String(event.error || '');
        optionsRef.current.onStatus(
          error === 'not-allowed' || error === 'service-not-allowed'
            ? 'Necesito permiso para usar el micrófono.'
            : 'No pude escuchar la frase. Toca el botón para intentarlo otra vez.'
        );
        setSessionInactive();
      };

      recognitionRef.current = recognition;
    }

    return () => {
      stopSession();
    };
  }, []);

  const toggle = async () => {
    optionsRef.current.onOpen();

    if (activeRef.current) {
      stopSession('Voz pausada.');
      return;
    }

    activeRef.current = true;
    setActive(true);
    optionsRef.current.onStatus('Preparando micrófono…');
    await startCapture();
  };

  return { active, listening, toggle };
}
