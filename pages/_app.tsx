import '../styles/index.css';
import { AppProps } from 'next/app';
//@ts-ignore
import { disableBodyScroll } from 'body-scroll-lock';
import { useEffect, useRef } from 'react';
import { NextComponentType, NextPageContext } from 'next';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    disableBodyScroll(document.querySelector('body'));
  }, []);
  return <Component {...pageProps} />;
}
