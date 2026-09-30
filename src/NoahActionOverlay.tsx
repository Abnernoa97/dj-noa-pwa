import { Check, Circle, LoaderCircle, Sparkles, X } from 'lucide-react';
import type { NoahActionActivity } from './noahEvents';

export default function NoahActionOverlay({ activity }: { activity: NoahActionActivity | null }) {
  if (!activity) return null;
  const steps = activity.steps || [];

  return (
    <div className={`noah-action-overlay ${activity.phase}`} role="status" aria-live="polite">
      <div className="noah-action-topline">
        <div className="noah-action-icon" aria-hidden="true">
          {activity.phase === 'working' ? <LoaderCircle size={17} className="spin" /> : activity.phase === 'done' ? <Check size={17} /> : <X size={17} />}
        </div>
        <div className="noah-action-copy">
          <div className="noah-action-kicker"><Sparkles size={11} /> NOAH · {activity.scope || 'EVENTOS'}</div>
          <strong>{activity.title}</strong>
          {activity.detail && <span>{activity.detail}</span>}
        </div>
      </div>

      {steps.length > 0 && <div className="noah-action-steps" aria-label="Progreso de la acción">
        {steps.map((step) => (
          <div className={`noah-action-step ${step.state}`} key={step.id}>
            <div className="noah-action-step-mark" aria-hidden="true">
              {step.state === 'done' ? <Check size={11} /> : step.state === 'active' ? <LoaderCircle size={11} className="spin" /> : <Circle size={8} />}
            </div>
            <span>{step.label}</span>
            {step.value && <strong>{step.value}</strong>}
          </div>
        ))}
      </div>}
    </div>
  );
}
