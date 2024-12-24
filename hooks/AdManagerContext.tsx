// AdManagerContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useEncryptedStorage } from './useEncryptedStorage';

interface Milestone {
  points: number;
  adFreeMinutes: number;
}

interface AdManagerContextProps {
  points: number;
  adsEnabled: boolean;
  addPoints: (interactionType: string) => void;
}

const AdManagerContext = createContext<AdManagerContextProps | undefined>(
  undefined,
);

interface AdManagerProviderProps {
  children: ReactNode;
  milestones: Milestone[];
  pointWeights: Record<string, number>;
  storageKey: string;
  envKey: string;
  debugMode?: boolean;
}

export function AdManagerProvider({
  children,
  milestones,
  pointWeights,
  storageKey,
  envKey,
  debugMode = false,
}: AdManagerProviderProps) {
  const { save, load } = useEncryptedStorage({ key: envKey, debugMode });
  const [points, setPoints] = useState<number>(0);
  const [adsDisabledUntil, setAdsDisabledUntil] = useState<Date | null>(null);

  // Load persisted state on first render
  useEffect(() => {
    const storedData = load(storageKey);
    if (storedData) {
      setPoints(storedData.points || 0);
      setAdsDisabledUntil(
        storedData.adsDisabledUntil
          ? new Date(storedData.adsDisabledUntil)
          : null,
      );
    }
  }, [load, storageKey]);

  // Save state changes
  useEffect(() => {
    save(storageKey, { points, adsDisabledUntil });
  }, [save, storageKey, points, adsDisabledUntil]);

  const addPoints = (interactionType: string) => {
    const weight = pointWeights[interactionType] || 0;
    const newPoints = points + weight;
    setPoints(newPoints);

    // Check for new milestone unlocks
    const nextMilestone = milestones.find((m) => m.points <= newPoints);
    if (nextMilestone) {
      const newDisableTime = new Date();
      newDisableTime.setMinutes(
        newDisableTime.getMinutes() + nextMilestone.adFreeMinutes,
      );
      setAdsDisabledUntil(newDisableTime);
    }
  };

  const adsEnabled = !adsDisabledUntil || new Date() > adsDisabledUntil;

  return (
    <AdManagerContext.Provider value={{ points, adsEnabled, addPoints }}>
      {children}
    </AdManagerContext.Provider>
  );
}

export function useAdManager() {
  const context = useContext(AdManagerContext);
  if (!context) {
    throw new Error('useAdManager must be used within AdManagerProvider');
  }
  return context;
}
