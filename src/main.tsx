import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import AppMaintenance from './AppMaintenance';
import DataSafetyPanel from './DataSafetyPanel';
import ExcelModulesEnhancer from './ExcelModulesEnhancer';
import HardRockMarketEnhancer from './HardRockMarketEnhancer';
import SportsEnhancer from './SportsEnhancer';
import './styles/core/styles.css';
import './features/events/styles/events.css';
import './features/events/styles/event-hub.css';
import './features/calendar/styles/calendar.css';
import './features/excel/styles/sheet.css';
import './features/excel/styles/sheet-fields.css';
import './features/tasks/styles/reminders.css';
import './styles/core/viewport-layout.css';
import './features/noah/styles/noah-voice.css';
import './features/noah/styles/noah-image.css';
import './features/noah/styles/noah-actions.css';
import './features/noah/styles/noah-calendar-live.css';
import './features/safety/styles/data-safety.css';
import './styles/core/visual-polish.css';
import './features/excel/styles/excel-scroll-fix.css';
import './styles/core/scroll-fix.css';
import './features/calendar/styles/calendar-focus.css';
import './features/calendar/styles/calendar-week-day.css';
import './features/events/styles/events-focus.css';
import './features/excel/styles/sheet-focus.css';
import './features/excel/styles/excel-modules.css';
import './features/tasks/styles/reminders-focus.css';
import './styles/core/overlay-layout.css';
import './features/home/styles/home-focus.css';
import './features/sports/styles/mlb.css';
import './features/sports/styles/mlb-matchups.css';
import './features/sports/styles/nba.css';
import './features/sports/styles/sports-detail.css';
import './features/sports/styles/hard-rock-market.css';
import './features/sports/styles/sports-context.css';
import './features/sports/styles/sports-realtime.css';
import './styles/core/ios-dark-redesign.css';
import './features/excel/styles/excel-landscape.css';

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
    <HardRockMarketEnhancer />
    <AppMaintenance />
    <DataSafetyPanel />
  </React.StrictMode>
);
