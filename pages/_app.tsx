import '../styles/index.css';
import { AppProps } from 'next/app';
import { useScrollLock } from '../hooks/useScrollLock';
import { QueryProvider } from '../hooks/useQuery';
import { StateProvider, useAppState } from '../hooks/useState';
import { InfoProviderProvider } from '../contexts/InfoProviderContext';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';
import CompactFeedbackWidget from '../components/CompactFeedbackWidget';
import ReactGA4 from 'react-ga4';
import { SpeedInsights } from '@vercel/speed-insights/next';

ReactGA4.initialize(process.env.NEXT_PUBLIC_GA_FOUR);

export default function App({ Component, pageProps }: AppProps) {
  // Use our custom scroll lock with allowed selectors for timeline and popups
  useScrollLock(true, {
    allowedSelectors: [
      '.timeline-years-container',
      '.popup-description', 
      '.country-info-description',
      '.mapboxgl-popup-content'
    ]
  });
  
  return (
    <QueryProvider>
      <StateProvider>
        <InfoProviderProvider>
          <FeedbackWrapper />
          <Component {...pageProps} />
          <SpeedInsights />
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
