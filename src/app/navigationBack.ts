import { useEffect, useRef } from 'react';

/**
 * One back action for the iOS-style button, Escape and the Android/PWA Back gesture.
 * Most recently opened layers have the highest priority; data operations are untouched.
 */
type Layer = { id: symbol; priority: number; action: () => void; order: number };
const layers: Layer[] = [];
let registrationOrder = 0;

export function useNativeBack(active: boolean, onBack: () => void, priority = 0) {
  const actionRef = useRef(onBack);
  actionRef.current = onBack;
  useEffect(() => {
    if (!active) return;
    const layer: Layer = {
      id: Symbol('DJ NOA back'),
      priority,
      order: ++registrationOrder,
      action: () => actionRef.current()
    };
    layers.push(layer);
    return () => {
      const index = layers.findIndex((entry) => entry.id === layer.id);
      if (index !== -1) layers.splice(index, 1);
    };
  }, [active, priority]);
}

export function performNativeBack() {
  const layer = layers.reduce<Layer | undefined>((best, entry) =>
    !best || entry.priority > best.priority || (entry.priority === best.priority && entry.order > best.order) ? entry : best,
  undefined);
  if (!layer) return false;
  layer.action();
  return true;
}

export function useSystemBack() {
  useEffect(() => {
    const marker = '__djNoaBackBoundary';
    const arm = () => {
      try {
        window.history.pushState({ ...(window.history.state || {}), [marker]: true }, '', window.location.href);
      } catch { /* history may be restricted in some embedded webviews */ }
    };
    arm();

    const onPopState = () => {
      if (performNativeBack()) {
        arm();
      } else if (window.history.length > 1) {
        // When already at Inicio, preserve the normal browser exit behavior.
        window.history.back();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return;
      const target = event.target as HTMLElement | null;
      if (event.key === 'Backspace' && (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || ''))) return;
      if (performNativeBack()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
