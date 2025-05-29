import React, { ReactNode } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SEO_CONFIG, generatePageTitle, generatePageDescription, generateCanonicalUrl } from '../config/seo';

type Props = {
  children?: ReactNode;
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  year?: string;
};

export default function Layout({
  children,
  title,
  description,
  url,
  image = SEO_CONFIG.defaultOgImage,
  year,
}: Props) {
  const router = useRouter();
  
  // Generate SEO content using centralized functions
  const pageTitle = generatePageTitle(title);
  const pageDescription = generatePageDescription(description, year);
  const canonicalUrl = url || generateCanonicalUrl(router.asPath);
  
  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": SEO_CONFIG.siteName,
    "description": SEO_CONFIG.defaultDescription,
    "url": SEO_CONFIG.siteUrl,
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Any",
    "browserRequirements": "Requires JavaScript",
    "author": {
      "@type": "Organization",
      "name": SEO_CONFIG.author,
      "url": SEO_CONFIG.organization.url
    },
    "datePublished": "2024-01-01",
    "inLanguage": SEO_CONFIG.language,
    "isAccessibleForFree": true,
    "keywords": SEO_CONFIG.keywords.join(', ')
  };

  return (
    <>
      <Head>
        {/* Primary Meta Tags */}
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={SEO_CONFIG.keywords.join(', ')} />
        <meta name="author" content={SEO_CONFIG.author} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        
        {/* Viewport and mobile optimization */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <meta name="theme-color" content={SEO_CONFIG.themeColor} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* Open Graph Meta Tags */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SEO_CONFIG.siteName} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={image} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`Historic borders visualization${year ? ` for year ${year}` : ''}`} />
        <meta property="og:locale" content={SEO_CONFIG.locale} />
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={image} />
        <meta name="twitter:image:alt" content={`Historic borders visualization${year ? ` for year ${year}` : ''}`} />
        <meta name="twitter:creator" content={SEO_CONFIG.twitterHandle} />
        <meta name="twitter:site" content={SEO_CONFIG.twitterHandle} />
        
        {/* Additional SEO Meta Tags */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content={SEO_CONFIG.themeColor} />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </Head>
      {children}
    </>
  );
}
