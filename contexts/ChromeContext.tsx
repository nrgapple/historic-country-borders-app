import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { trackEvent } from '../lib/analytics';

/** Which overlay is open. Only one panel or dialog is open at a time. */
export type Overlay = 'settings' | 'about' | 'feedback' | null;

interface ChromeContextValue {
  /** When true, only the map and a restore button are shown. */
  focusMode: boolean;
  toggleFocusMode: () => void;
  overlay: Overlay;
  openOverlay: (overlay: Exclude<Overlay, null>) => void;
  closeOverlay: () => void;
}

const ChromeContext = createContext<ChromeContextValue | undefined>(undefined);

export const ChromeProvider = ({ children }: { children: ReactNode }) => {
  const [focusMode, setFocusMode] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);

  const toggleFocusMode = useCallback(() => {
    trackEvent('focus_mode', { enabled: !focusMode });
    setFocusMode(!focusMode);
    setOverlay(null);
  }, [focusMode]);

  const openOverlay = useCallback((next: Exclude<Overlay, null>) => {
    setOverlay((current) => (current === next ? null : next));
    trackEvent('overlay_open', { overlay: next });
  }, []);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const value = useMemo(
    () => ({ focusMode, toggleFocusMode, overlay, openOverlay, closeOverlay }),
    [focusMode, toggleFocusMode, overlay, openOverlay, closeOverlay],
  );

  return (
    <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>
  );
};

export const useChrome = () => {
  const context = useContext(ChromeContext);
  if (!context) throw new Error('useChrome must be used within ChromeProvider');
  return context;
};
