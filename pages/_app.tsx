import '@fontsource-variable/source-serif-4/wght.css';
import '../styles/index.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { ChromeProvider } from '../contexts/ChromeContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { initAnalytics, trackPageview } from '../lib/analytics';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Analytics is optional and never competes with the map for startup time.
    const start = () => initAnalytics();
    const idle = (
      window as Window & {
        requestIdleCallback?: (callback: () => void) => number;
      }
    ).requestIdleCallback;
    if (idle) idle(start);
    else setTimeout(start, 2000);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const send = (url: string) => trackPageview(url.split('?')[0]);
    send(router.asPath);
    router.events.on('routeChangeComplete', send);
    return () => router.events.off('routeChangeComplete', send);
    // Only (re)subscribe when the router becomes ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  return (
    <SettingsProvider>
      <ChromeProvider>
        <Component {...pageProps} />
      </ChromeProvider>
    </SettingsProvider>
  );
}
