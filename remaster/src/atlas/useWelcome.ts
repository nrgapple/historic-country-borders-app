import { useEffect, useRef, useState } from 'react';
import {
  getWelcomeStorage,
  rememberWelcomeSeen,
  welcomeDecision,
  type WelcomeDecision,
} from '../lib/welcome';
import { actions, useAtlas } from './store';

/**
 * Shows the welcome once per release (src/lib/welcome.ts decides whether).
 *
 * - Never in focus (projector) mode, over another overlay, or over a place
 *   panel. Selecting a place, opening another overlay or entering focus mode
 *   closes it.
 * - A page opened on a shared `?place=` link keeps its first view: the welcome
 *   waits for the visitor's first interaction and for the panel to close.
 * - Any close counts as a dismissal and is remembered.
 *
 * Returns whether the welcome is open.
 */
export function useWelcome() {
  const overlay = useAtlas((s) => s.overlay);
  const focusMode = useAtlas((s) => s.focusMode);
  const place = useAtlas((s) => s.place);
  const [decision, setDecision] = useState<WelcomeDecision | null>(null);
  const [interacted, setInteracted] = useState(false);
  const autoShown = useRef(false);
  const open = overlay === 'welcome';

  // Decide once, after hydration (storage is client-only).
  useEffect(() => {
    setDecision(
      welcomeDecision({
        storage: getWelcomeStorage(),
        search: window.location.search,
      }),
    );
  }, []);

  useEffect(() => {
    if (decision !== 'defer' || interacted) return;
    const onInteract = () => setInteracted(true);
    const options = { capture: true, once: true } as const;
    window.addEventListener('pointerdown', onInteract, options);
    window.addEventListener('keydown', onInteract, options);
    return () => {
      window.removeEventListener('pointerdown', onInteract, options);
      window.removeEventListener('keydown', onInteract, options);
    };
  }, [decision, interacted]);

  useEffect(() => {
    if (autoShown.current || !decision || decision === 'skip') return;
    if (decision === 'defer' && !interacted) return;
    if (overlay !== null || focusMode || place) return;
    autoShown.current = true;
    actions.openWelcome('notes', { auto: true });
  }, [decision, interacted, overlay, focusMode, place]);

  // A selected place takes the welcome's space (both are sheets on phones).
  useEffect(() => {
    if (place && open) actions.closeOverlay();
  }, [place, open]);

  // Remember every close, however it happened.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) rememberWelcomeSeen(getWelcomeStorage());
    wasOpen.current = open;
  }, [open]);

  return open;
}
