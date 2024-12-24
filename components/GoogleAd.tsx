import React from 'react';
import { useGoogleAds } from '../hooks/useGoogleAds';

interface GoogleAdProps {
  adClient: string;
  adSlot: string;
  className?: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
  adsEnabled: boolean;
  onClose: () => void;
}

export function GoogleAd({
  adClient,
  adSlot,
  className = '',
  adFormat = 'auto',
  fullWidthResponsive = true,
  adsEnabled,
  onClose,
}: GoogleAdProps) {
  useGoogleAds({ adClient, adSlot, adFormat, fullWidthResponsive });

  if (!adsEnabled) {
    return null;
  }

  return (
    <div className={`ad-container ${className}`}>
      <button className="close-ad-btn" onClick={onClose}>
        ✕
      </button>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive.toString()}
      />
    </div>
  );
}
