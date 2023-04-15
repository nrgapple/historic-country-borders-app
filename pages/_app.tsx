import '../styles/index.css';
import { AppProps } from 'next/app';
//@ts-ignore
import { disableBodyScroll } from 'body-scroll-lock';
import { useEffect, useRef } from 'react';
import { QueryProvider } from '../hooks/useQuery';
import { StateProvider } from '../hooks/useState';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';
import '@upstash/feedback/index.css';
import FeedbackWidget from '../components/feedback';
import '../components/feedback/styles.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    disableBodyScroll(document.querySelector('body'));
  }, []);
  return (
    <QueryProvider>
      <StateProvider>
        <FeedbackWidget
          title="Hey There 👋"
          description="Let me know how I can make this better or just give me a 😊."
          themeColor="#6930c3"
          textColor="white"
          customIcon={<div style={{ fontSize: 30 }}>👋</div>}
          type="full"
          metadata={process.env.NODE_ENV === 'development' ? { dev: true } : {}}
        />
        <Component {...pageProps} />;
      </StateProvider>
    </QueryProvider>
  );
}
