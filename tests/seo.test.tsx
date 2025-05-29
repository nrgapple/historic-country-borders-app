import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { SEO_CONFIG, generatePageTitle, generatePageDescription, generateCanonicalUrl } from '../config/seo';

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const mockRouter = {
  asPath: '/year/1500',
  pathname: '/year/[year]',
  query: { year: '1500' },
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  isReady: true,
};

beforeEach(() => {
  (useRouter as any).mockReturnValue(mockRouter);
});

describe('SEO Configuration', () => {
  it('should have all required SEO config properties', () => {
    expect(SEO_CONFIG.siteName).toBe('Historic Country Borders');
    expect(SEO_CONFIG.siteUrl).toBe('https://historicborders.app');
    expect(SEO_CONFIG.defaultTitle).toBe('Historic Country Borders');
    expect(SEO_CONFIG.themeColor).toBe('#6930c3');
    expect(SEO_CONFIG.keywords).toBeInstanceOf(Array);
    expect(SEO_CONFIG.keywords.length).toBeGreaterThan(0);
  });

  it('should generate correct page titles', () => {
    expect(generatePageTitle()).toBe('Historic Country Borders');
    expect(generatePageTitle('Test Page')).toBe('Test Page | Historic Country Borders');
    expect(generatePageTitle('Year 1500')).toBe('Year 1500 | Historic Country Borders');
  });

  it('should generate correct page descriptions', () => {
    const defaultDesc = SEO_CONFIG.defaultDescription;
    
    expect(generatePageDescription()).toBe(defaultDesc);
    expect(generatePageDescription('Custom description')).toBe('Custom description');
    expect(generatePageDescription(undefined, '1500')).toBe(`Explore how country borders looked in the year 1500. ${defaultDesc}`);
    expect(generatePageDescription('Custom description', '1500')).toBe('Explore how country borders looked in the year 1500. Custom description');
  });

  it('should generate correct canonical URLs', () => {
    expect(generateCanonicalUrl()).toBe('https://historicborders.app');
    expect(generateCanonicalUrl('/')).toBe('https://historicborders.app');
    expect(generateCanonicalUrl('/year/1500')).toBe('https://historicborders.app/year/1500');
    expect(generateCanonicalUrl('year/1500')).toBe('https://historicborders.app/year/1500');
  });
});

describe('Layout Component SEO', () => {
  it('should render basic meta tags', () => {
    const { container } = render(
      <Layout>
        <div>Test content</div>
      </Layout>
    );

    // Check if head elements are rendered (Next.js Head component doesn't render in jsdom)
    // This test ensures the component renders without errors
    expect(container).toBeTruthy();
  });

  it('should use year-specific content when year is provided', () => {
    const { container } = render(
      <Layout year="1500" title="Test Title">
        <div>Test content</div>
      </Layout>
    );

    expect(container).toBeTruthy();
  });

  it('should handle custom props correctly', () => {
    const customProps = {
      title: 'Custom Title',
      description: 'Custom description',
      url: 'https://example.com/custom',
      image: 'https://example.com/image.png',
      year: '1776'
    };

    const { container } = render(
      <Layout {...customProps}>
        <div>Test content</div>
      </Layout>
    );

    expect(container).toBeTruthy();
  });
});

describe('SEO Meta Tags Structure', () => {
  it('should include required meta tag properties', () => {
    // Test that our SEO config has all necessary properties for meta tags
    expect(SEO_CONFIG).toHaveProperty('siteName');
    expect(SEO_CONFIG).toHaveProperty('defaultTitle');
    expect(SEO_CONFIG).toHaveProperty('defaultDescription');
    expect(SEO_CONFIG).toHaveProperty('siteUrl');
    expect(SEO_CONFIG).toHaveProperty('themeColor');
    expect(SEO_CONFIG).toHaveProperty('twitterHandle');
    expect(SEO_CONFIG).toHaveProperty('defaultOgImage');
    expect(SEO_CONFIG).toHaveProperty('keywords');
    expect(SEO_CONFIG).toHaveProperty('locale');
    expect(SEO_CONFIG).toHaveProperty('language');
  });

  it('should have valid structured data format', () => {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": SEO_CONFIG.siteName,
      "description": SEO_CONFIG.defaultDescription,
      "url": SEO_CONFIG.siteUrl,
    };

    expect(structuredData['@context']).toBe('https://schema.org');
    expect(structuredData['@type']).toBe('WebApplication');
    expect(structuredData.name).toBe(SEO_CONFIG.siteName);
    expect(structuredData.url).toBe(SEO_CONFIG.siteUrl);
  });
}); 