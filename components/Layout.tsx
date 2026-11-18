import React, { ReactNode } from 'react';
import Head from 'next/head';
import {
  generateCanonicalUrl,
  generatePageTitle,
  SEO_CONFIG,
} from '../config/seo';

interface LayoutProps {
  children?: ReactNode;
  /** Page title without the site name. Omit for the default site title. */
  title?: string;
  description?: string;
  /** Canonical path, e.g. "/year/1492". */
  path: string;
  image?: string;
  noindex?: boolean;
}

export default function Layout({
  children,
  title,
  description = SEO_CONFIG.defaultDescription,
  path,
  image = SEO_CONFIG.defaultOgImage,
  noindex = false,
}: LayoutProps) {
  const pageTitle = generatePageTitle(title);
  const canonicalUrl = generateCanonicalUrl(path);

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        {noindex && <meta name="robots" content="noindex" />}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SEO_CONFIG.siteName} />
        <meta property="og:locale" content={SEO_CONFIG.locale} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={image} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="A historical world map with colored territories and a timeline"
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      {children}
    </>
  );
}
