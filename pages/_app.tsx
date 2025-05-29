import '../styles/index.css';
import { AppProps } from 'next/app';
import { useScrollLock } from '../hooks/useScrollLock';
import { QueryProvider } from '../hooks/useQuery';
import { StateProvider, useAppState } from '../hooks/useState';
import { InfoProviderProvider } from '../contexts/InfoProviderContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { CompareProvider } from '../contexts/CompareContext';
import SettingsApplier from '../components/SettingsApplier';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';
import CompactFeedbackWidget from '../components/CompactFeedbackWidget';
import ReactGA4 from 'react-ga4';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  // Initialize GA4 only on client side
  useEffect(() => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (process.env.NEXT_PUBLIC_GA_FOUR) {
      ReactGA4.initialize(process.env.NEXT_PUBLIC_GA_FOUR, {
        testMode: isDevelopment, // Enable test mode in development - prevents data from being sent to Google
      });

      // Log the current configuration in development
      if (isDevelopment) {
        console.log('[Analytics] GA4 initialized in TEST mode - data will NOT be sent to Google');
        console.log('[Analytics] Test mode enabled for development');
        console.log('[Analytics] Measurement ID:', process.env.NEXT_PUBLIC_GA_FOUR);
      }
    }
  }, []);

  // Use our custom scroll lock with allowed selectors for timeline and popups
  useScrollLock(true, {
    allowedSelectors: [
      '.timeline-years-container',
      '.popup-description', 
      '.country-info-description',
      '.mapboxgl-popup-content',
      '.compare-popup-content',
      '.compare-history-list'
    ]
  });
  
  return (
    <QueryProvider>
      <StateProvider>
        <InfoProviderProvider>
          <SettingsProvider>
            <CompareProvider>
              <SettingsApplier />
              <FeedbackWrapper />
              <Component {...pageProps} />
              <SpeedInsights />
            </CompareProvider>
          </SettingsProvider>
        </InfoProviderProvider>
      </StateProvider>
    </QueryProvider>
  );
}

function FeedbackWrapper() {
  const {
    state: { hide },
  } = useAppState();
  return (
    <>
      {!hide && (
        <CompactFeedbackWidget
          title="Hey There 👋"
          description="Let me know how I can make this better or just give me a 😊. (Map data is not mine. Please create an issue from the github link in the bottom right to help them fix any issues.)"
          themeColor="#6930c3"
          textColor="white"
        />
      )}
    </>
  );
}
