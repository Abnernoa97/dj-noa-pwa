import { useEffect, useRef, useState } from 'react';
import type { RecognitionEventLike, RecognitionLike, VoiceMode, VoiceOptions } from './voice/recognitionTypes';
import { getRecognitionCtor, WAKE_WORD } from './voice/transcript';

const WAKE_RESTART_MS = 900;
const GREETINGS = [
  'Hola. ¿Qué hacemos?',
  'Aquí estoy. ¿Qué vamos a hacer?',
  'Hola. ¿En qué te ayudo?',
  'Te escucho. ¿Qué hacemos hoy?'
];

function transcriptParts(event: RecognitionEventLike) {
  let finalText = '';
  let interimText = '';
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    const text = String(result?.[0]?.transcript || '').trim();
    if (!text) continue;
    if (result.isFinal) finalText += `${text} `;
    else interimText += `${text} `;
  }
  return {
    finalText: finalText.trim(),
    interimText: interimText.trim(),
    heard: (finalText || interimText).trim()
  };
}

function voiceScore(voice: SpeechSynthesisVoice) {
  const name = (voice.name || '').toLowerCase();
  const lang = (voice.lang || '').toLowerCase();
  let score = 0;

  if (lang === 'es-mx') score += 120;
  else if (lang.startsWith('es-mx')) score += 110;
  else if (lang === 'es-us') score += 95;
  else if (lang.startsWith('es')) score += 75;
  else score -= 200;

  if (/natural|neural|premium|enhanced/.test(name)) score += 55;
  if (name.includes('google')) score += 40;
  if (name.includes('samsung')) score += 35;
  if (name.includes('microsoft')) score += 30;
  if (/mexic|méxic/.test(name)) score += 25;
  if (/latin|latam|américa|america/.test(name)) score += 18;
  if (/espeak|pico|compact|basic|robot/.test(name)) score -= 100;
  if (voice.localService) score += 5;

  return score;
}

export function useDjNoaVoice(options: VoiceOptions) {
  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [manualRecording, setManualRecording] = useState(false);
  const [wakeListening, setWakeListening] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [conversationActive, setConversationActive] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mountedRef = useRef(true);
  const wakeRecognitionRef = useRef<RecognitionLike | null>(null);
  const inputRecognitionRef = useRef<RecognitionLike | null>(null);
  const wakeRunningRef = useRef(false);
  const wakePausedRef = useRef(false);
  const wakeDeniedRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const manualTextRef = useRef('');
  const voiceTextRef = useRef('');
  const submittedRef = useRef(false);
  const inputKindRef = useRef<'manual' | 'voice' | null>(null);

  const setVoiceMode = (next: VoiceMode) => setMode(next);

  const clearWakeRestart = () => {
    if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  };

  const chooseVoice = () => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices().filter((voice) => (voice.lang || '').toLowerCase().startsWith('es'));
    selectedVoiceRef.current = voices.sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
    return selectedVoiceRef.current;
  };

  const scheduleWake = (delay = WAKE_RESTART_MS) => {
    clearWakeRestart();
    if (!mountedRef.current || wakePausedRef.current || wakeDeniedRef.current) return;
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      startWakeListening();
    }, delay);
  };

  const suspendWake = () => {
    wakePausedRef.current = true;
    clearWakeRestart();
    setWakeListening(false);
    if (wakeRunningRef.current) {
      try { wakeRecognitionRef.current?.abort(); } catch { /* noop */ }
    }
    wakeRunningRef.current = false;
  };

  const resumeWake = () => {
    wakePausedRef.current = false;
    scheduleWake(350);
  };

  const finishVoiceTurn = () => {
    setActive(false);
    setConversationActive(false);
    setListening(false);
    setManualRecording(false);
    setVoiceMode('idle');
    inputKindRef.current = null;
    inputRecognitionRef.current = null;
    voiceTextRef.current = '';
    submittedRef.current = false;
    resumeWake();
  };

  const speak = (text: string, after?: () => void) => {
    const clean = text.trim();
    if (!clean || !('speechSynthesis' in window)) {
      after?.();
      return;
    }

    suspendWake();
    setVoiceMode('speaking');
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = selectedVoiceRef.current || chooseVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'es-MX';
    } else {
      utterance.lang = 'es-MX';
    }
    utterance.rate = 0.92;
    utterance.pitch = 0.98;
    utterance.volume = 1;
    utterance.onend = () => after?.();
    utterance.onerror = () => after?.();
    window.speechSynthesis.speak(utterance);
  };

  const processVoiceCommand = async (text: string) => {
    const clean = text.trim();
    if (!clean) {
      finishVoiceTurn();
      return;
    }

    setListening(false);
    setVoiceMode('processing');
    optionsRef.current.onStatus('Pensando…');
    try {
      const reply = await optionsRef.current.onCommand(clean);
      const answer = reply?.trim();
      if (!answer) {
        finishVoiceTurn();
        return;
      }
      optionsRef.current.onStatus(answer);
      speak(answer, finishVoiceTurn);
    } catch {
      const message = 'No pude completar eso. Inténtalo otra vez.';
      optionsRef.current.onStatus(message);
      speak(message, finishVoiceTurn);
    }
  };

  const startVoiceInput = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      optionsRef.current.onStatus('Este navegador no ofrece entrada de voz. Puedes escribirme.');
      finishVoiceTurn();
      return;
    }

    submittedRef.current = false;
    voiceTextRef.current = '';
    inputKindRef.current = 'voice';
    const recognition = new Ctor();
    recognition.lang = 'es-MX';
    recognition.interimResults = true;
    recognition.continuous = false;
    inputRecognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const { finalText, heard } = transcriptParts(event);
      if (heard) {
        voiceTextRef.current = heard;
        optionsRef.current.onStatus(`NOAH · ${heard}`);
      }
      if (finalText && !submittedRef.current) {
        submittedRef.current = true;
        voiceTextRef.current = finalText;
        try { recognition.stop(); } catch { /* noop */ }
      }
    };

    recognition.onerror = (event) => {
      const error = String(event.error || '');
      if (error === 'aborted') return;
      setListening(false);
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        optionsRef.current.onStatus('Necesito permiso para usar el micrófono.');
      } else if (error === 'no-speech') {
        optionsRef.current.onStatus('No te escuché.');
      } else {
        optionsRef.current.onStatus('No te escuché bien. Inténtalo otra vez.');
      }
      finishVoiceTurn();
    };

    recognition.onend = () => {
      setListening(false);
      const heard = voiceTextRef.current.trim();
      inputRecognitionRef.current = null;
      inputKindRef.current = null;
      if (!heard) {
        finishVoiceTurn();
        return;
      }
      void processVoiceCommand(heard);
    };

    try {
      recognition.start();
      setListening(true);
      setVoiceMode('wake');
      optionsRef.current.onStatus('NOAH · Te escucho…');
    } catch {
      optionsRef.current.onStatus('No pude iniciar el micrófono.');
      finishVoiceTurn();
    }
  };

  const activateVoice = (remainder = '') => {
    suspendWake();
    optionsRef.current.onOpen('voice');
    setActive(true);
    setConversationActive(true);
    setVoiceMode('wake');

    const clean = remainder.trim();
    if (clean) {
      void processVoiceCommand(clean);
      return;
    }

    const greeting = GREETINGS[Math.floor(Date.now() / 60000) % GREETINGS.length];
    optionsRef.current.onStatus(greeting);
    speak(greeting, startVoiceInput);
  };

  function startWakeListening() {
    if (!mountedRef.current || wakePausedRef.current || wakeDeniedRef.current || wakeRunningRef.current) return;
    if (document.visibilityState !== 'visible') return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    if (!wakeRecognitionRef.current) {
      const recognition = new Ctor();
      recognition.lang = 'es-MX';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        const { finalText } = transcriptParts(event);
        if (!finalText) return;
        const match = finalText.match(WAKE_WORD);
        if (!match) return;
        const end = (match.index || 0) + match[0].length;
        const remainder = finalText.slice(end).replace(/^[\s,.:;!?-]+/, '').trim();
        activateVoice(remainder);
      };

      recognition.onerror = (event) => {
        wakeRunningRef.current = false;
        setWakeListening(false);
        const error = String(event.error || '');
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          wakeDeniedRef.current = true;
          return;
        }
        if (!wakePausedRef.current) scheduleWake(1200);
      };

      recognition.onend = () => {
        wakeRunningRef.current = false;
        setWakeListening(false);
        if (!wakePausedRef.current) scheduleWake();
      };

      wakeRecognitionRef.current = recognition;
    }

    try {
      wakeRecognitionRef.current.start();
      wakeRunningRef.current = true;
      setWakeListening(true);
    } catch {
      // Chromium can reject start while a previous recognition session is closing.
    }
  }

  const startManual = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      optionsRef.current.onStatus('Este navegador no ofrece dictado por voz.');
      resumeWake();
      return;
    }

    suspendWake();
    optionsRef.current.onOpen('manual');
    manualTextRef.current = '';
    inputKindRef.current = 'manual';
    const recognition = new Ctor();
    recognition.lang = 'es-MX';
    recognition.interimResults = true;
    recognition.continuous = false;
    inputRecognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const { finalText, heard } = transcriptParts(event);
      if (!heard) return;
      manualTextRef.current = finalText || heard;
      optionsRef.current.onLiveText(heard);
      if (finalText) {
        manualTextRef.current = finalText;
        optionsRef.current.onLiveText(finalText);
        try { recognition.stop(); } catch { /* noop */ }
      }
    };

    recognition.onerror = (event) => {
      const error = String(event.error || '');
      if (error === 'aborted') return;
      setListening(false);
      setManualRecording(false);
      setVoiceMode('idle');
      optionsRef.current.onStatus(error === 'not-allowed' || error === 'service-not-allowed'
        ? 'Necesito permiso para usar el micrófono.'
        : 'No te escuché bien. Inténtalo otra vez.');
      inputRecognitionRef.current = null;
      inputKindRef.current = null;
      resumeWake();
    };

    recognition.onend = () => {
      setListening(false);
      setManualRecording(false);
      setVoiceMode('idle');
      const text = manualTextRef.current.trim();
      if (text) {
        optionsRef.current.onLiveText(text);
        optionsRef.current.onStatus('Listo para enviar.');
      }
      inputRecognitionRef.current = null;
      inputKindRef.current = null;
      resumeWake();
    };

    try {
      recognition.start();
      setActive(true);
      setListening(true);
      setManualRecording(true);
      setVoiceMode('manual');
      optionsRef.current.onStatus('Te escucho…');
    } catch {
      setActive(false);
      optionsRef.current.onStatus('No pude iniciar el micrófono.');
      resumeWake();
    }
  };

  const toggle = () => {
    if (mode === 'manual' && inputRecognitionRef.current) {
      try { inputRecognitionRef.current.stop(); } catch { /* noop */ }
      return;
    }

    if (mode === 'wake' || mode === 'processing' || mode === 'speaking') {
      try { inputRecognitionRef.current?.abort(); } catch { /* noop */ }
      window.speechSynthesis?.cancel();
      finishVoiceTurn();
      return;
    }

    startManual();
  };

  useEffect(() => {
    mountedRef.current = true;
    chooseVoice();
    const synth = window.speechSynthesis;
    const onVoicesChanged = () => chooseVoice();
    synth?.addEventListener?.('voiceschanged', onVoicesChanged);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        resumeWake();
      } else {
        suspendWake();
        try { inputRecognitionRef.current?.abort(); } catch { /* noop */ }
        window.speechSynthesis?.cancel();
        setListening(false);
        setManualRecording(false);
        setVoiceMode('idle');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    scheduleWake(900);

    return () => {
      mountedRef.current = false;
      clearWakeRestart();
      wakePausedRef.current = true;
      try { wakeRecognitionRef.current?.abort(); } catch { /* noop */ }
      try { inputRecognitionRef.current?.abort(); } catch { /* noop */ }
      window.speechSynthesis?.cancel();
      synth?.removeEventListener?.('voiceschanged', onVoicesChanged);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return {
    active,
    conversationActive,
    listening,
    manualRecording,
    wakeListening,
    mode,
    toggle,
    stop: finishVoiceTurn
  };
}
