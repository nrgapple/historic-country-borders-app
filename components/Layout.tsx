import React, { ReactNode } from 'react';
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
          content={title ?? 'Historic Borders'}
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
        <meta name="twitter:url" content="https://historicborders.app" />
        <meta property="og:site_name" content="HistoricBorders" />
      </Head>
      {children}
    </>
  );
}
