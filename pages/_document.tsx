import { Head, Html, Main, NextScript } from 'next/document';
import { SEO_CONFIG } from '../config/seo';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SEO_CONFIG.siteName,
  url: SEO_CONFIG.siteUrl,
  description: SEO_CONFIG.defaultDescription,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript and WebGL',
  isAccessibleForFree: true,
  inLanguage: SEO_CONFIG.language,
};

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={SEO_CONFIG.themeColor} />
        <meta name="format-detection" content="telephone=no" />
        <link rel="preconnect" href="https://api.mapbox.com" crossOrigin="" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
