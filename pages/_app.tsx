import '../styles/index.css';
import { AppProps } from 'next/app';
//@ts-ignore
import { disableBodyScroll } from 'body-scroll-lock';
import { useEffect, useRef } from 'react';
import { QueryProvider } from '../hooks/useQuery';
import { StateProvider } from '../hooks/useState';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    disableBodyScroll(document.querySelector('body'));
  }, []);
  return (
    <QueryProvider>
      <StateProvider>
        <Component {...pageProps} />;
      </StateProvider>
    </QueryProvider>
  );
}
