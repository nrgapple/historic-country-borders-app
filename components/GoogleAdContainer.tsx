// GoogleAdContainer.tsx
import React from 'react';
import { useAdManager } from '../hooks/AdManagerContext';
import { GoogleAd } from './GoogleAd';

export function GoogleAdContainer() {
  const { adsEnabled } = useAdManager();

  return (
    <GoogleAd
      adClient="ca-pub-1234567890"
      adSlot="1234567890"
      className="custom-ad-style"
      adsEnabled={adsEnabled}
      onClose={() => console.log('Ad closed')}
    />
  );
}
