import { Check, LoaderCircle, Sparkles, X } from 'lucide-react';
import type { NoahActionActivity } from './noahEvents';

export default function NoahActionOverlay({ activity }: { activity: NoahActionActivity | null }) {
  if (!activity) return null;
  return (
    <div className={`noah-action-overlay ${activity.phase}`} role="status" aria-live="polite">
      <div className="noah-action-icon" aria-hidden="true">
        {activity.phase === 'working' ? <LoaderCircle size={18} className="spin" /> : activity.phase === 'done' ? <Check size={18} /> : <X size={18} />}
      </div>
      <div className="noah-action-copy">
        <div className="noah-action-kicker"><Sparkles size={11} /> NOAH · EVENTOS</div>
        <strong>{activity.title}</strong>
        {activity.detail && <span>{activity.detail}</span>}
      </div>
    </div>
  );
}
