import { useEffect } from 'react';
import { optimizeStoredPhotos } from './photoOptimization';

export default function AppMaintenance() {
  useEffect(() => {
    let timer = window.setTimeout(() => void optimizeStoredPhotos(), 1800);
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void optimizeStoredPhotos(), 1200);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return null;
}
