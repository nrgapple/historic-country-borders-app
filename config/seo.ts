export const SEO_CONFIG = {
  // Site information
  siteName: 'Historic Country Borders',
  siteUrl: 'https://historicborders.app',
  defaultTitle: 'Historic Country Borders',
  titleTemplate: '%s | Historic Country Borders',
  defaultDescription: 'Visualize country borders from different times in history (123,000 BC - 1994). Interactive historical maps showing how borders changed over time.',
  
  // Social media
  twitterHandle: '@historicborders',
  
  // Images
  defaultOgImage: 'https://historicborders.app/og-image.png',
  favicon: '/favicon.ico',
  
  // Colors and branding
  themeColor: '#6930c3',
  backgroundColor: '#252525',
  
  // Keywords
  keywords: [
    'historical maps',
    'country borders',
    'history',
    'geography',
    'interactive maps',
    'timeline',
    'historical data',
    'political boundaries',
    'territorial changes',
    'world history',
    'cartography',
    'border evolution'
  ],
  
  // Additional meta
  language: 'en',
  locale: 'en_US',
  author: 'Historic Borders Project',
  
  // Structured data
  organization: {
    name: 'Historic Borders Project',
    url: 'https://historicborders.app',
    logo: 'https://historicborders.app/logo.png'
  }
};

export const generatePageTitle = (title?: string) => {
  if (!title) return SEO_CONFIG.defaultTitle;
  return `${title} | ${SEO_CONFIG.siteName}`;
};

export const generatePageDescription = (description?: string, year?: string) => {
  if (year && description) {
    return `Explore how country borders looked in the year ${year}. ${description}`;
  }
  if (year) {
    return `Explore how country borders looked in the year ${year}. ${SEO_CONFIG.defaultDescription}`;
  }
  return description || SEO_CONFIG.defaultDescription;
};

export const generateCanonicalUrl = (path?: string) => {
  const cleanPath = path?.startsWith('/') ? path : `/${path || ''}`;
  return `${SEO_CONFIG.siteUrl}${cleanPath}`.replace(/\/$/, '') || SEO_CONFIG.siteUrl;
}; 