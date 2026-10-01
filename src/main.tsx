import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import AppMaintenance from './AppMaintenance';
import DataSafetyPanel from './DataSafetyPanel';
import ExcelModulesEnhancer from './ExcelModulesEnhancer';
import SportsEnhancer from './SportsEnhancer';
import './styles.css';
import './events.css';
import './event-hub.css';
import './calendar.css';
import './sheet.css';
import './sheet-fields.css';
import './reminders.css';
import './viewport-layout.css';
import './noah-voice.css';
import './noah-actions.css';
import './noah-calendar-live.css';
import './data-safety.css';
import './visual-polish.css';
import './excel-scroll-fix.css';
import './scroll-fix.css';
import './calendar-focus.css';
import './calendar-week-day.css';
import './events-focus.css';
import './sheet-focus.css';
import './excel-modules.css';
import './reminders-focus.css';
import './overlay-layout.css';
import './home-focus.css';
import './mlb.css';
import './mlb-matchups.css';
import './nba.css';
import './sports-detail.css';
import './sports-context.css';
import './sports-realtime.css';

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
    <ExcelModulesEnhancer />
    <SportsEnhancer />
    <AppMaintenance />
    <DataSafetyPanel />
  </React.StrictMode>
);
