import ReactGA4 from 'react-ga4';

/**
 * Centralized AI Feature Analytics Tracking
 * 
 * This utility provides consistent tracking for all AI-related features
 * and user interactions throughout the application.
 */

export interface AIAnalyticsEvent {
  action: string;
  label?: string;
  value?: number;
  customParameters?: Record<string, any>;
}

/**
 * Track AI feature events with consistent category and formatting
 */
export const trackAIEvent = ({ action, label, value, customParameters }: AIAnalyticsEvent) => {
  ReactGA4.event({
    category: 'AI Feature',
    action,
    label,
    value,
    ...customParameters,
  });
};

/**
 * AI Provider Events
 */
export const AIProviderEvents = {
  toggle: (fromProvider: string, toProvider: string) => {
    trackAIEvent({
      action: 'toggle_provider',
      label: `${fromProvider}_to_${toProvider}`,
      value: 1,
    });
  },

  enable: (provider: string) => {
    trackAIEvent({
      action: provider === 'ai' ? 'enable_ai' : 'disable_ai',
      label: provider,
      value: 1,
    });
  },

  restored: (provider: string) => {
    trackAIEvent({
      action: 'provider_restored',
      label: provider,
      value: 1,
    });
  },

  defaultUsed: (provider: string) => {
    trackAIEvent({
      action: 'provider_default',
      label: provider,
      value: 1,
    });
  },

  sessionActive: (provider: string) => {
    trackAIEvent({
      action: 'session_provider_active',
      label: provider,
      value: 1,
    });
  },
};

/**
 * AI Request Events
 */
export const AIRequestEvents = {
  initiated: (country: string, year: string) => {
    trackAIEvent({
      action: 'request_initiated',
      label: `${country}_${year}`,
      value: 1,
    });
  },

  success: (country: string, year: string, responseTime: number, contentLength: number, wordCount: number) => {
    trackAIEvent({
      action: 'response_success',
      label: `${country}_${year}`,
      value: 1,
    });

    trackAIEvent({
      action: 'response_time_success',
      label: `${country}_${year}`,
      value: Math.round(responseTime),
    });

    trackAIEvent({
      action: 'response_length',
      label: `${country}_${year}`,
      value: contentLength,
    });

    trackAIEvent({
      action: 'response_word_count',
      label: `${country}_${year}`,
      value: wordCount,
    });
  },

  failed: (country: string, year: string, responseTime: number, errorType?: string) => {
    trackAIEvent({
      action: 'request_failed',
      label: `${country}_${year}`,
      value: 1,
    });

    trackAIEvent({
      action: 'response_time_failed',
      label: `${country}_${year}`,
      value: Math.round(responseTime),
    });

    if (errorType) {
      trackAIEvent({
        action: 'error_type',
        label: `${errorType}_${country}_${year}`,
        value: 1,
      });
    }
  },

  apiError: (country: string, year: string, statusCode: number, responseTime: number) => {
    trackAIEvent({
      action: 'api_error',
      label: `${statusCode}_${country}_${year}`,
      value: statusCode,
    });

    trackAIEvent({
      action: 'response_time_error',
      label: `${country}_${year}`,
      value: Math.round(responseTime),
    });
  },

  empty: (country: string, year: string) => {
    trackAIEvent({
      action: 'response_empty',
      label: `${country}_${year}`,
      value: 1,
    });
  },

  formatError: (country: string, year: string) => {
    trackAIEvent({
      action: 'response_format_error',
      label: `${country}_${year}`,
      value: 1,
    });
  },

  missingApiKey: (country: string, year: string) => {
    trackAIEvent({
      action: 'api_key_missing',
      label: `${country}_${year}`,
      value: 1,
    });
  },
};

/**
 * Content Display Events
 */
export const AIContentEvents = {
  popupDisplayed: (provider: string, country: string) => {
    trackAIEvent({
      action: 'popup_displayed',
      label: `${provider}_${country}`,
      value: 1,
    });
  },

  contentDisplayed: (provider: string, country: string, wordCount: number, contentLength: number) => {
    trackAIEvent({
      action: 'content_displayed',
      label: `${provider}_${country}`,
      value: 1,
    });

    trackAIEvent({
      action: 'content_word_count',
      label: `${provider}_${country}`,
      value: wordCount,
    });

    trackAIEvent({
      action: 'content_length',
      label: `${provider}_${country}`,
      value: contentLength,
    });
  },

  errorDisplayed: (provider: string, country: string) => {
    trackAIEvent({
      action: 'content_error_displayed',
      label: `${provider}_${country}`,
      value: 1,
    });
  },

  emptyDisplayed: (provider: string, country: string) => {
    trackAIEvent({
      action: 'content_empty_displayed',
      label: `${provider}_${country}`,
      value: 1,
    });
  },

  popupClosed: (provider: string, country: string) => {
    trackAIEvent({
      action: 'popup_closed',
      label: `${provider}_${country}`,
      value: 1,
    });
  },
};

/**
 * Storage Events
 */
export const AIStorageEvents = {
  saved: (provider: string) => {
    trackAIEvent({
      action: 'provider_saved',
      label: provider,
      value: 1,
    });
  },

  saveError: (provider: string) => {
    trackAIEvent({
      action: 'localstorage_save_error',
      label: provider,
      value: 1,
    });
  },

  readError: () => {
    trackAIEvent({
      action: 'localstorage_read_error',
      label: 'provider_preference',
      value: 1,
    });
  },
};

/**
 * Performance Tracking
 */
export const AIPerformanceEvents = {
  responseTime: (country: string, year: string, time: number, success: boolean) => {
    const action = success ? 'response_time_success' : 'response_time_failed';
    trackAIEvent({
      action,
      label: `${country}_${year}`,
      value: Math.round(time),
    });
  },

  contentQuality: (country: string, year: string, wordCount: number, charCount: number) => {
    trackAIEvent({
      action: 'content_quality_metrics',
      label: `${country}_${year}`,
      value: 1,
      customParameters: {
        word_count: wordCount,
        char_count: charCount,
        words_per_char: wordCount / charCount,
      },
    });
  },
};

/**
 * Usage Pattern Tracking
 */
export const AIUsageEvents = {
  sessionStart: (provider: string) => {
    trackAIEvent({
      action: 'session_started',
      label: provider,
      value: 1,
    });
  },

  featureDiscovery: (source: string) => {
    trackAIEvent({
      action: 'feature_discovered',
      label: source,
      value: 1,
    });
  },

  comparisonUsage: (fromProvider: string, toProvider: string, country: string) => {
    trackAIEvent({
      action: 'provider_comparison',
      label: `${fromProvider}_vs_${toProvider}_${country}`,
      value: 1,
    });
  },
};

/**
 * Helper function to track user engagement patterns
 */
export const trackUserEngagement = (
  provider: string,
  country: string,
  year: string,
  engagementType: 'view' | 'close' | 'switch_provider' | 'retry'
) => {
  trackAIEvent({
    action: `user_engagement_${engagementType}`,
    label: `${provider}_${country}_${year}`,
    value: 1,
  });
};

/**
 * Batch tracking for multiple events
 */
export const trackBatchEvents = (events: AIAnalyticsEvent[]) => {
  events.forEach(event => trackAIEvent(event));
};

export default {
  trackAIEvent,
  AIProviderEvents,
  AIRequestEvents,
  AIContentEvents,
  AIStorageEvents,
  AIPerformanceEvents,
  AIUsageEvents,
  trackUserEngagement,
  trackBatchEvents,
}; 