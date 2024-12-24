// useGoogleAds.ts - Custom Hook
import { useEffect } from 'react';

interface UseGoogleAdsOptions {
  adClient: string;
  adSlot: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
}

declare global {
  interface Window {
    adsbygoogle: { push: (arg: object) => void };
  }
}

export function useGoogleAds({
  adClient,
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
}: UseGoogleAdsOptions) {
  useEffect(() => {
    const loadAds = () => {
      if (typeof window !== 'undefined' && window.adsbygoogle) {
        window.adsbygoogle.push({});
      }
    };

    const scriptId = 'google-ads-sdk';

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src =
        'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
      script.async = true;
      script.onload = loadAds;
      document.head.appendChild(script);
    } else {
      loadAds();
    }
  }, [adClient, adSlot, adFormat, fullWidthResponsive]);
}
