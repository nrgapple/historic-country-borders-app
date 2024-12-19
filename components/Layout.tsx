import React, { ReactNode } from 'react';
import Link from 'next/link';
import Head from 'next/head';

type Props = {
  children?: ReactNode;
  title?: string;
  description?: string;
  url?: string;
};

export default function Layout({
  children,
  title = 'History Borders',
  description = 'Visualize country borders from different times in history (123,000 BC - 1994)',
  url = 'https://historicborders.app',
}: Props) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <meta name="theme-color" content="#6930c3" />
        <meta property="og:title" content={title} key="og-title" />
        <meta property="og:type" content="article" />
        <meta
          property="og:description"
          content={description}
          key="og-description"
        />
        <meta property="og:url" content={url} key="og-url" />
        <meta
          name="title"
          content={title ?? 'Progressive App Store'}
          key="title"
        />
        <meta name="description" content={description} key="description" />
        <meta name="url" content={url} key="url" />
        <meta name="twitter:card" content="summary" />
        <meta property="twitter:title" content={title} key="twitter-title" />
        <meta
          property="twitter:description"
          content={description}
          key="twitter-description"
        />
        <meta
          property="twitter:site"
          content="Historic Borders"
          key="twitter-site"
        />
        <meta
          property="twitter:image:height"
          content="1200"
          key="twitter-height"
        />
        <meta
          property="twitter:image:width"
          content="1200"
          key="twitter-width"
        />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="mask-icon" href="/icons/mask-icon.svg" color="#FFFFFF" />
        <link rel="apple-touch-icon" href="/icons/touch-icon-iphone.png" />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/icons/touch-icon-ipad.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/touch-icon-iphone-retina.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="167x167"
          href="/icons/touch-icon-ipad-retina.png"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="twitter:url" content="https://historicborders.app" />
        <meta name="twitter:image" content="/icons/twitter.png" />
        <meta name="twitter:creator" content="@DavidWShadow" />
        <meta property="og:site_name" content="HistoricBorders" />
        <meta property="og:image" content="/icons/og.png" />
        <link
          rel="apple-touch-startup-image"
          href="/images/apple_splash_2048.png"
          sizes="2048x2732"
        />
        <link
          rel="apple-touch-startup-image"
          href="/images/apple_splash_1668.png"
          sizes="1668x2224"
        />
        <link
          rel="apple-touch-startup-image"
          href="/images/apple_splash_1536.png"
          sizes="1536x2048"
        />
        <link
          rel="apple-touch-startup-image"
          href="/images/apple_splash_1125.png"
          sizes="1125x2436"
        />
        <link
          rel="apple-touch-startup-image"
          href="/images/apple_splash_1242.png"
          sizes="1242x2208"
        />
        <link
          rel="apple-touch-startup-image"
          href="/images/apple_splash_750.png"
          sizes="750x1334"
        />
        <link
          rel="apple-touch-startup-image"
          href="/images/apple_splash_640.png"
          sizes="640x1136"
        />
      </Head>
      {children}
    </>
  );
}
