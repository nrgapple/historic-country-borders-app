import '../styles/index.css';
import { AppProps } from 'next/app';
//@ts-ignore
import { disableBodyScroll } from 'body-scroll-lock';
import { useEffect } from 'react';
import { QueryProvider } from '../hooks/useQuery';
import { StateProvider, useAppState } from '../hooks/useState';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';
import FeedbackWidget from '../components/feedback';
import '../components/feedback/styles.css';
import ReactGA4 from 'react-ga4';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AdManagerProvider } from '../hooks/AdManagerContext';
import {
  DEBUG_MODE,
  ENV_KEY,
  MILESTONES,
  POINT_WEIGHTS,
} from '../util/constants';
import { GoogleAdContainer } from '../components/GoogleAdContainer';

ReactGA4.initialize(process.env.NEXT_PUBLIC_GA_FOUR);

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    disableBodyScroll(document.querySelector('body') as HTMLBodyElement);
  }, []);
  return (
    <QueryProvider>
      <StateProvider>
        <AdManagerProvider
          milestones={MILESTONES}
          pointWeights={POINT_WEIGHTS}
          storageKey="user_ad_milestones"
          envKey={ENV_KEY}
          debugMode={DEBUG_MODE}
        >
          <FeedbackWrapper />
          <Component {...pageProps} />
          <SpeedInsights />
          <GoogleAdContainer />
        </AdManagerProvider>
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
        <FeedbackWidget
          title="Hey There 👋"
          description="Let me know how I can make this better or just give me a 😊. (Map data is not mine. Please create an issue from the github link in the bottom right to help them fix any issues.)"
          themeColor="#6930c3"
          textColor="white"
          customIcon={<div style={{ fontSize: 30 }}>👋</div>}
          type="full"
          metadata={process.env.NODE_ENV === 'development' ? { dev: true } : {}}
        />
      )}
    </>
  );
}
