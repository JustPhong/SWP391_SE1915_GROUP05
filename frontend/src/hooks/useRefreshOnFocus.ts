import { useEffect, useRef } from 'react';

interface UseRefreshOnFocusOptions {
  /** When false, listeners are not attached and onRefresh is never called */
  enabled: boolean;
  /** Called when the window regains focus or the document becomes visible */
  onRefresh: () => void | Promise<void>;
}

/**
 * Registers stable window focus and document visibilitychange listeners.
 * When either event fires and the document is visible the supplied callback
 * is invoked once.  Listeners are removed on component unmount.
 *
 * A ref guard ensures that simultaneous focus + visibilitychange events
 * trigger only a single callback execution.
 */
export function useRefreshOnFocus({ enabled, onRefresh }: UseRefreshOnFocusOptions): void {
  // Keep a stable reference to the callback so the effect doesn't need to
  // re-register listeners every time onRefresh changes identity.
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const handle = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    };

    window.addEventListener('focus', handle);
    document.addEventListener('visibilitychange', handle);

    return () => {
      window.removeEventListener('focus', handle);
      document.removeEventListener('visibilitychange', handle);
    };
  }, [enabled]);
}
