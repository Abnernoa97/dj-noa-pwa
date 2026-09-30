import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import AppMaintenance from './AppMaintenance';
import AssistantPlanPreview from './AssistantPlanPreview';
import DataSafetyPanel from './DataSafetyPanel';
import './styles.css';
import './events.css';
import './event-hub.css';
import './calendar.css';
import './sheet.css';
import './sheet-fields.css';
import './reminders.css';
import './viewport-layout.css';
import './live-actions.css';
import './assistant-plan.css';
import './voice-modes.css';
import './conversation-dock.css';
import './data-safety.css';
import './visual-polish.css';
import './excel-scroll-fix.css';
import './scroll-fix.css';
import './calendar-focus.css';
import './calendar-week-day.css';
import './events-focus.css';
import './sheet-focus.css';
import './reminders-focus.css';
import './overlay-layout.css';
import './home-focus.css';
import './mlb.css';

let refreshing = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW?.(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    void registration.update();
    window.setInterval(() => void registration.update(), 5 * 60 * 1000);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <AppMaintenance />
    <AssistantPlanPreview />
    <DataSafetyPanel />
  </React.StrictMode>
);
