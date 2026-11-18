import { useEffect, useState } from 'react';

export const useFingerPrint = (enabled = true) => {
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || fingerprint) return;
    let active = true;

    const getFingerprint = async () => {
      const { default: FingerprintJS } =
        await import('@fingerprintjs/fingerprintjs');
      // monitoring: false stops FingerprintJS's usage ping to openfpcdn.io,
      // so the feedback form contacts no third-party host.
      const fp = await FingerprintJS.load({ monitoring: false });
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
