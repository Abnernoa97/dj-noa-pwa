import { useCallback, useEffect, useRef, useState } from 'react';

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'portrait' | 'landscape') => Promise<void>;
};

function orientationApi(): LockableOrientation | undefined {
  return typeof screen === 'undefined' ? undefined : screen.orientation as LockableOrientation | undefined;
}

function isPortraitViewport(): boolean {
  return typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
}

/**
 * Applies the requested orientation only to Excel. The PWA manifest allows
 * rotation, while supported Android browsers can lock it programmatically.
 * Browser rejection is normal: an explicit button and physical-rotate hint
 * remain available; no CSS rotation of the document or stored data is done.
 */
export function useExcelLandscape(active: boolean) {
  const [isPortrait, setIsPortrait] = useState(isPortraitViewport);
  const activeRef = useRef(active);
  activeRef.current = active;

  const requestLandscape = useCallback(async (): Promise<boolean> => {
    if (!activeRef.current) return false;
    const orientation = orientationApi();
    if (!orientation || typeof orientation.lock !== 'function') return false;
    try {
      await orientation.lock('landscape');
      return true;
    } catch {
      // Android/browser may require an installed PWA or fullscreen permission.
      return false;
    }
  }, []);

  useEffect(() => {
    const orientation = orientationApi();
    if (!active) {
      document.body.classList.remove('excel-landscape-scope');
      // The manifest cannot remain portrait-only because Excel must rotate.
      // Re-establish portrait for other screens when the platform supports it.
      if (typeof orientation?.lock === 'function') {
        void orientation.lock('portrait').catch(() => {
          try { orientation.unlock?.(); } catch { /* unsupported */ }
        });
      }
      return;
    }

    document.body.classList.add('excel-landscape-scope');
    const updateViewport = () => setIsPortrait(isPortraitViewport());
    updateViewport();
    void requestLandscape();
    window.addEventListener('resize', updateViewport);
    orientation?.addEventListener?.('change', updateViewport);

    return () => {
      document.body.classList.remove('excel-landscape-scope');
      window.removeEventListener('resize', updateViewport);
      orientation?.removeEventListener?.('change', updateViewport);
    };
  }, [active, requestLandscape]);

  return { isPortrait, requestLandscape };
}
