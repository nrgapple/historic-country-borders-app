import { useEffect, useState } from 'react';

export const useFingerPrint = (enabled = true) => {
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || fingerprint) return;
    let active = true;

    const getFingerprint = async () => {
      const { default: FingerprintJS } =
        await import('@fingerprintjs/fingerprintjs');
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      if (active) setFingerprint(result.visitorId);
    };
    void getFingerprint();

    return () => {
      active = false;
    };
  }, [enabled, fingerprint]);

  return fingerprint;
};
