import '../styles/index.css';
import { AppProps } from 'next/app';
//@ts-ignore
import { disableBodyScroll } from 'body-scroll-lock';
import { useEffect, useRef } from 'react';
import { QueryProvider } from '../hooks/useQuery';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    disableBodyScroll(document.querySelector('body'));
  }, []);
  return (
    <QueryProvider>
      <Component {...pageProps} />;
    </QueryProvider>
  );
}
