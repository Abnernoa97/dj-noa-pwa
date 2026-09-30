import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Mic, Send, Sparkles, Square } from 'lucide-react';

export type ConversationTurn = {
  id: string;
  command: string;
  result: string;
  createdAt?: string;
};

type VoiceMode = 'idle' | 'manual' | 'wake' | 'processing' | 'speaking';

type OrbPosition = { x: number; y: number };

type Props = {
  expanded: boolean;
  turns: ConversationTurn[];
  pendingCommand?: string | null;
  reply: string;
  command: string;
  onCommandChange: (value: string) => void;
  onSend: () => void;
  onVoice: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  busy: boolean;
  listening: boolean;
  manualRecording: boolean;
  wakeListening?: boolean;
  voiceMode: VoiceMode;
  aiOnline: boolean | null;
};

const POSITION_KEY = 'dj-noa-noah-orb-position-v1';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function readableReply(value: string) {
  const text = value.trim();
  if (!text || text === '…' || /^(preparando|grabando|entendiendo|enviando|trabajando)/i.test(text)) return '';
  if (text === 'Dime qué necesitas y lo hago.') return '';
  return text;
}

export default function ConversationDock({
  expanded,
  turns,
  pendingCommand,
  reply,
  command,
  onCommandChange,
  onSend,
  onVoice,
  onExpand,
  onCollapse,
  busy,
  listening,
  manualRecording,
  wakeListening = false,
  voiceMode,
  aiOnline
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [orbPosition, setOrbPosition] = useState<OrbPosition | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<OrbPosition>;
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return;
      setOrbPosition({
        x: clamp(parsed.x, 8, Math.max(8, window.innerWidth - 72)),
        y: clamp(parsed.y, 72, Math.max(72, window.innerHeight - 150))
      });
    } catch {
      // Keep the default corner if a stale value cannot be read.
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      setOrbPosition((current) => current ? {
        x: clamp(current.x, 8, Math.max(8, window.innerWidth - 72)),
        y: clamp(current.y, 72, Math.max(72, window.innerHeight - 150))
      } : current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!expanded) setHistoryOpen(false);
  }, [expanded]);

  const saveOrbPosition = (position: OrbPosition) => {
    try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* localStorage may be unavailable */ }
  };

  const onOrbPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = orbPosition?.x ?? rect.left;
    const originY = orbPosition?.y ?? rect.top;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX,
      originY,
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onOrbPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 7) drag.moved = true;
    if (!drag.moved) return;
    const next = {
      x: clamp(drag.originX + dx, 8, Math.max(8, window.innerWidth - 72)),
      y: clamp(drag.originY + dy, 72, Math.max(72, window.innerHeight - 150))
    };
    setOrbPosition(next);
  };

  const finishOrbPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    if (drag.moved) {
      if (orbPosition) saveOrbPosition(orbPosition);
      return;
    }
    if (expanded) onCollapse();
    else onExpand();
  };

  const latestReply = readableReply(reply);
  const visibleTurns = turns.slice(-14);
  const orbState = listening ? 'listening' : busy || voiceMode === 'processing' ? 'thinking' : voiceMode === 'speaking' ? 'speaking' : wakeListening ? 'ready' : 'idle';
  const statusText = manualRecording
    ? 'DICTANDO · TOCA ■ PARA TERMINAR'
    : voiceMode === 'wake' && listening
      ? 'NOAH · TE ESCUCHO'
      : busy
        ? 'NOAH · PENSANDO'
        : aiOnline === false
          ? 'NOAH · LOCAL'
          : 'NOAH';

  return (
    <>
      {expanded && historyOpen && (
        <section className="noah-history" aria-label="Conversación con Noah">
          <div className="noah-history-head">
            <div><span>CONVERSACIÓN</span><strong>Noah</strong></div>
            <button onClick={() => setHistoryOpen(false)} aria-label="Cerrar historial">×</button>
          </div>
          <div className="noah-history-scroll">
            {visibleTurns.map((turn) => (
              <div className="noah-turn" key={turn.id}>
                <p className="user">{turn.command}</p>
                <p className="assistant"><Sparkles size={13} />{turn.result}</p>
              </div>
            ))}
            {pendingCommand && (
              <div className="noah-turn pending">
                <p className="user">{pendingCommand}</p>
                <p className="assistant"><Sparkles size={13} />{reply || 'Pensando…'}</p>
              </div>
            )}
            {!visibleTurns.length && !pendingCommand && <p className="noah-history-empty">Aquí aparecerá la misma conversación, sin reiniciar el contexto.</p>}
          </div>
        </section>
      )}

      {expanded && (
        <section className="noah-composer-shell" aria-label="Hablar o escribir a Noah">
          {!historyOpen && latestReply && (
            <button className="noah-reply-peek" onClick={() => setHistoryOpen(true)}>
              <Sparkles size={13} />
              <span>{latestReply}</span>
            </button>
          )}

          <div className={`noah-composer ${manualRecording ? 'recording' : ''}`}>
            <button className="noah-thread-toggle" onClick={() => setHistoryOpen((value) => !value)} aria-label="Ver conversación">
              <MessageCircle size={18} />
              {turns.length > 0 && <span>{Math.min(turns.length, 99)}</span>}
            </button>

            <div className="noah-input-wrap">
              <textarea
                value={command}
                rows={1}
                onChange={(event) => onCommandChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (command.trim() && !busy) onSend();
                  }
                }}
                placeholder={manualRecording ? 'Te estoy escuchando…' : 'Escribe o habla con Noah'}
                aria-label="Mensaje para Noah"
              />
              <small>{statusText}</small>
            </div>

            <button className={`noah-mic ${manualRecording || listening ? 'active' : ''}`} onClick={onVoice} aria-label={manualRecording ? 'Terminar dictado' : 'Dictar mensaje'}>
              {manualRecording ? <Square size={15} fill="currentColor" /> : <Mic size={19} />}
            </button>

            <button className="noah-send" onClick={onSend} disabled={busy || !command.trim()} aria-label="Enviar mensaje">
              <Send size={18} />
            </button>
          </div>
        </section>
      )}

      <button
        className={`noah-orb ${orbState} ${expanded ? 'open' : ''}`}
        style={orbPosition ? { left: orbPosition.x, top: orbPosition.y, right: 'auto', bottom: 'auto' } : undefined}
        onPointerDown={onOrbPointerDown}
        onPointerMove={onOrbPointerMove}
        onPointerUp={finishOrbPointer}
        onPointerCancel={() => { dragRef.current = null; }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (expanded) onCollapse(); else onExpand();
          }
        }}
        aria-label={expanded ? 'Cerrar Noah' : 'Abrir Noah'}
      >
        <span className="noah-orb-ring ring-a" />
        <span className="noah-orb-ring ring-b" />
        <span className="noah-orb-core"><Sparkles size={22} /></span>
      </button>
    </>
  );
}
