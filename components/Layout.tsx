import React, { ReactNode } from 'react';
import Link from 'next/link';
import Head from 'next/head';

type Props = {
  children?: ReactNode;
  title?: string;
  description?: string;
  url?: string;
};

const Layout = ({
  children,
  title = 'History Borders',
  description = 'Visualize country borders from different times in history (2000 BC-1994)',
  url = 'https://historicborders.app',
}: Props) => (
  <>
    <Head>
      <title>{title}</title>
      {/* <link rel="manifest" href="/manifest.json" /> */}
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      />
      {/* <link rel="apple-touch-icon" sizes="192x192" href="/logo-bg-192.png" /> */}
      <meta name="theme-color" content="#6930c3" />
      <meta property="og:title" content={title} key="og-title" />
      <meta property="og:type" content="article" />
      <meta
        property="og:description"
        content={description}
        key="og-description"
      />
      {/* <meta
        property="og:image"
        content={image ?? defaultImage}
        key="og-image"
      /> */}
      <meta property="og:url" content={url} key="og-url" />
      <meta
        name="title"
        content={title ?? 'Progressive App Store'}
        key="title"
      />
      <meta name="description" content={description} key="description" />
      {/* <meta name="image" content={image ?? defaultImage} key="image" /> */}
      <meta name="url" content={url} key="url" />
      <meta name="twitter:card" content="summary" />
      <meta property="twitter:title" content={title} key="twitter-title" />
      <meta
        property="twitter:description"
        content={description}
        key="twitter-description"
      />
      {/* <meta
        property="twitter:image:src"
        content={image ?? defaultImage}
        key="twitter-image"
      /> */}
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
      <meta property="twitter:image:width" content="1200" key="twitter-width" />
    </Head>
    {children}
  </>
);

export default Layout;
