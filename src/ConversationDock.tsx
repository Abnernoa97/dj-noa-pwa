import { ChevronDown, Mic, Send, Sparkles, Square } from 'lucide-react';

export type ConversationTurn = {
  id: string;
  command: string;
  result: string;
  createdAt?: string;
};

type VoiceMode = 'idle' | 'manual' | 'wake' | 'processing' | 'speaking';

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
  voiceMode: VoiceMode;
  aiOnline: boolean | null;
};

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
  voiceMode,
  aiOnline
}: Props) {
  const visibleTurns = turns.slice(-4);
  const status = aiOnline === true ? 'AI · ONLINE' : aiOnline === false ? 'MODO LOCAL' : 'AI · ...';

  if (!expanded) {
    return (
      <button className="dj-thread-collapsed" onClick={onExpand} aria-label="Abrir conversación con DJ NOA">
        <Sparkles size={14} />
        <span><strong>DJ NOA</strong>{reply}</span>
      </button>
    );
  }

  return (
    <section className="dj-thread-dock" aria-label="Conversación con DJ NOA">
      <div className="dj-thread-head">
        <div>
          <span>DJ NOA · {status}</span>
          <strong>Misma conversación</strong>
        </div>
        <button onClick={onCollapse} aria-label="Minimizar conversación"><ChevronDown size={18} /></button>
      </div>

      <div className="dj-thread-scroll">
        {visibleTurns.map((turn) => (
          <div className="dj-thread-turn" key={turn.id}>
            <p className="user">{turn.command}</p>
            <p className="assistant"><Sparkles size={12} />{turn.result}</p>
          </div>
        ))}
        {pendingCommand && (
          <div className="dj-thread-turn pending">
            <p className="user">{pendingCommand}</p>
            <p className="assistant"><Sparkles size={12} />{reply || 'Procesando…'}</p>
          </div>
        )}
        {!visibleTurns.length && !pendingCommand && <p className="dj-thread-empty">Dime qué necesitas. Voy manteniendo el hilo mientras trabajamos.</p>}
      </div>

      <div className="dj-thread-live">
        <span className={busy ? 'working' : ''} />
        <small>{manualRecording ? 'Grabando hasta que tú decidas enviar' : voiceMode === 'wake' ? 'Comando DJ NOA activo' : busy ? 'Trabajando…' : reply}</small>
      </div>

      <div className="dj-thread-compose">
        <input
          value={command}
          onChange={(event) => onCommandChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && command.trim() && !busy) onSend(); }}
          placeholder="Continúa: “no, mejor el viernes…”"
        />
        <button className={`dj-thread-voice ${manualRecording ? 'recording' : ''}`} onClick={onVoice} aria-label={manualRecording ? 'Terminar y enviar' : 'Hablar'}>
          {manualRecording ? <Square size={15} fill="currentColor" /> : <Mic size={17} />}
        </button>
        <button className="dj-thread-send" onClick={onSend} disabled={busy || !command.trim()} aria-label="Enviar"><Send size={16} /></button>
      </div>
      {manualRecording && <div className="dj-thread-stop-note">TOCA ■ PARA TERMINAR Y ENVIAR</div>}
      {listening && !manualRecording && voiceMode === 'wake' && <div className="dj-thread-stop-note">DJ NOA · TE ESCUCHO</div>}
    </section>
  );
}
