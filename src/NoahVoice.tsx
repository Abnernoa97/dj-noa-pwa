import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

type VoiceStatus = 'idle' | 'starting' | 'listening' | 'thinking' | 'speaking' | 'error';
type ChatTurn = { role: 'user' | 'assistant'; content: string };
type OrbPosition = { x: number; y: number };

export type NoahVoiceHandle = {
  start: () => void;
  stop: () => void;
};

const POSITION_KEY = 'dj-noa-voice-button-position-v1';
const TURN_SILENCE_MS = 1400;
const CLOSE_SESSION = /^(?:listo|terminamos|termina|eso es todo|ya estuvo|gracias(?: noah| noa)?|cierra(?: la conversación)?|hasta luego)$/i;

function recognitionCtor() {
  const scope = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSpeech(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const NoahVoice = forwardRef<NoahVoiceHandle>(function NoahVoice(_, ref) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [position, setPosition] = useState<OrbPosition | null>(null);

  const activeRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const turnTimerRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const speakingRef = useRef(false);
  const stoppingRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const finalPartsRef = useRef<string[]>([]);
  const interimRef = useRef('');
  const lastSubmittedRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const historyRef = useRef<ChatTurn[]>([]);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  const clearTurnTimer = () => {
    if (turnTimerRef.current !== null) window.clearTimeout(turnTimerRef.current);
    turnTimerRef.current = null;
  };

  const resetTurnBuffer = () => {
    clearTurnTimer();
    finalPartsRef.current = [];
    interimRef.current = '';
  };

  const closeRecognition = (abort = false) => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognitionRef.current = null;
    try {
      if (abort) recognition.abort?.();
      else recognition.stop?.();
    } catch { /* noop */ }
  };

  const stopSession = () => {
    stoppingRef.current = true;
    activeRef.current = false;
    setActive(false);
    setStatus('idle');
    processingRef.current = false;
    speakingRef.current = false;
    resetTurnBuffer();
    closeRecognition(true);
    try { window.speechSynthesis?.cancel?.(); } catch { /* noop */ }
    window.setTimeout(() => { stoppingRef.current = false; }, 120);
  };

  const startRecognition = () => {
    if (!activeRef.current || stoppingRef.current || processingRef.current || speakingRef.current || document.visibilityState !== 'visible') return;
    if (recognitionRef.current) return;

    const Ctor = recognitionCtor();
    if (!Ctor) {
      setStatus('error');
      return;
    }

    resetTurnBuffer();
    setStatus('starting');

    const recognition = new Ctor();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      if (activeRef.current && recognitionRef.current === recognition && !speakingRef.current && !processingRef.current) {
        setStatus('listening');
      }
    };

    recognition.onresult = (event: any) => {
      if (!activeRef.current || processingRef.current || speakingRef.current || recognitionRef.current !== recognition || Date.now() < ignoreUntilRef.current) return;

      let heardSomething = false;
      let latestInterim = interimRef.current;

      for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = String(result?.[0]?.transcript || '').trim();
        if (!text) continue;
        heardSomething = true;

        if (result?.isFinal) {
          finalPartsRef.current.push(text);
          latestInterim = '';
        } else {
          latestInterim = text;
        }
      }

      interimRef.current = latestInterim;
      if (heardSomething) {
        clearTurnTimer();
        turnTimerRef.current = window.setTimeout(() => {
          const pieces = [...finalPartsRef.current];
          const interim = interimRef.current.trim();
          if (interim) pieces.push(interim);
          const fullText = pieces.join(' ').replace(/\s+/g, ' ').trim();
          resetTurnBuffer();
          closeRecognition(false);
          if (fullText) void askNoah(fullText);
        }, TURN_SILENCE_MS);
      }
    };

    recognition.onerror = (event: any) => {
      const error = String(event?.error || '');
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!activeRef.current || stoppingRef.current || error === 'aborted') return;

      const pieces = [...finalPartsRef.current];
      const interim = interimRef.current.trim();
      if (interim) pieces.push(interim);
      const fullText = pieces.join(' ').replace(/\s+/g, ' ').trim();
      resetTurnBuffer();

      if (fullText) {
        void askNoah(fullText);
        return;
      }

      if (error === 'not-allowed' || error === 'service-not-allowed') {
        setStatus('error');
        stopSession();
        return;
      }

      // Android/Google may end a recognition window by itself. Do not auto-restart it:
      // restarting here is what causes the repeated microphone activation sound.
      stopSession();
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (!activeRef.current || stoppingRef.current || processingRef.current || speakingRef.current) return;

      const pieces = [...finalPartsRef.current];
      const interim = interimRef.current.trim();
      if (interim) pieces.push(interim);
      const fullText = pieces.join(' ').replace(/\s+/g, ' ').trim();
      resetTurnBuffer();

      if (fullText) {
        void askNoah(fullText);
        return;
      }

      // No automatic onend -> start loop. If Google closes an empty listening window,
      // the session simply returns to idle and the button can start a fresh conversation.
      stopSession();
    };

    try {
      recognition.start();
    } catch {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setStatus('error');
      stopSession();
    }
  };

  const speak = (text: string, after?: () => void) => {
    const clean = text.trim();
    if (!clean || !('speechSynthesis' in window)) {
      after?.();
      return;
    }

    resetTurnBuffer();
    closeRecognition(false);
    speakingRef.current = true;
    setStatus('speaking');
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'es-MX';
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.volume = 1;

    const done = () => {
      speakingRef.current = false;
      ignoreUntilRef.current = Date.now() + 250;
      if (!activeRef.current) return;
      after?.();
    };

    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  };

  const askNoah = async (message: string) => {
    const clean = message.trim();
    if (!clean || !activeRef.current || processingRef.current || speakingRef.current) return;

    const normalized = normalizeSpeech(clean);
    const previousSubmission = lastSubmittedRef.current;
    if (normalized && normalized === previousSubmission.text && Date.now() - previousSubmission.at < 5000) return;
    lastSubmittedRef.current = { text: normalized, at: Date.now() };

    if (CLOSE_SESSION.test(clean)) {
      speak('Listo.', stopSession);
      return;
    }

    processingRef.current = true;
    setStatus('thinking');
    const previous = historyRef.current.slice(-10);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 9000);
      const response = await fetch('/api/noah-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: clean, history: previous }),
        signal: controller.signal
      });
      window.clearTimeout(timeout);
      if (!response.ok) throw new Error('chat_unavailable');
      const payload = await response.json() as { text?: string };
      const answer = String(payload.text || '').trim() || 'Dime otra vez.';
      const userTurn: ChatTurn = { role: 'user', content: clean };
      const assistantTurn: ChatTurn = { role: 'assistant', content: answer };
      historyRef.current = [...previous, userTurn, assistantTurn].slice(-12);
      processingRef.current = false;
      if (activeRef.current) speak(answer, startRecognition);
    } catch {
      processingRef.current = false;
      if (activeRef.current) speak('No pude responder ahora. Dime otra vez.', startRecognition);
    }
  };

  const startSession = () => {
    if (activeRef.current) return;
    if (!recognitionCtor()) {
      setStatus('error');
      return;
    }

    activeRef.current = true;
    stoppingRef.current = false;
    historyRef.current = [];
    lastSubmittedRef.current = { text: '', at: 0 };
    resetTurnBuffer();
    setActive(true);
    setStatus('starting');

    speak('Hola, ¿en qué te puedo ayudar hoy?', startRecognition);
  };

  useImperativeHandle(ref, () => ({ start: startSession, stop: stopSession }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POSITION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as OrbPosition;
        if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
          setPosition({
            x: clamp(saved.x, 10, Math.max(10, window.innerWidth - 70)),
            y: clamp(saved.y, 70, Math.max(70, window.innerHeight - 150))
          });
        }
      }
    } catch { /* noop */ }

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' && activeRef.current) stopSession();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopSession();
    };
  }, []);

  const pointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position?.x ?? rect.left,
      originY: position?.y ?? rect.top,
      moved: false
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* noop */ }
  };

  const pointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    event.preventDefault();
    setPosition({
      x: clamp(drag.originX + dx, 10, Math.max(10, window.innerWidth - 70)),
      y: clamp(drag.originY + dy, 70, Math.max(70, window.innerHeight - 150))
    });
  };

  const pointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    if (drag.moved) {
      if (position) {
        try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* noop */ }
      }
      return;
    }
    if (activeRef.current) stopSession();
    else startSession();
  };

  return (
    <button
      type="button"
      className={`noah-voice-orb ${status} ${active ? 'active' : ''}`}
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={() => { dragRef.current = null; }}
      aria-label={active ? 'Terminar conversación con Noah' : 'Hablar con Noah'}
      title={active ? 'Terminar conversación' : 'Hablar con Noah'}
    >
      <span className="noah-voice-ring" />
      <span className="noah-voice-core">{active ? <Square size={15} fill="currentColor" /> : <Mic size={22} />}</span>
    </button>
  );
});

export default NoahVoice;
