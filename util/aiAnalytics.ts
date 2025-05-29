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
 * Track AI feature events with modern GA4 format
 */
export const trackAIEvent = ({ action, label, value, customParameters }: AIAnalyticsEvent) => {
  // Convert old format to new modern GA4 format
  const eventName = `ai_${action}`;
  const eventParams = {
    ...customParameters,
    ...(label && { label }),
    ...(value !== undefined && { value })
  };
  
  ReactGA4.event(eventName, eventParams);
};

/**
 * AI Provider Events
 */
export const AIProviderEvents = {
  toggle: (fromProvider: string, toProvider: string) => {
    ReactGA4.event('ai_provider_toggle', {
      previous_provider: fromProvider,
      new_provider: toProvider,
      toggle_direction: toProvider === 'ai' ? 'enable_ai' : 'disable_ai'
    });
  },

  enable: (provider: string) => {
    ReactGA4.event(provider === 'ai' ? 'ai_feature_enabled' : 'ai_feature_disabled', {
      provider: provider,
      activation_method: 'provider_toggle'
    });
  },

  restored: (provider: string) => {
    ReactGA4.event('ai_provider_restored', {
      provider: provider,
      restoration_source: 'localStorage'
    });
  },

  defaultUsed: (provider: string) => {
    ReactGA4.event('ai_provider_default_used', {
      provider: provider,
      reason: 'no_stored_preference'
    });
  },

  sessionActive: (provider: string) => {
    ReactGA4.event('ai_provider_session_active', {
      provider: provider,
      session_type: 'active_usage'
    });
  },
};

/**
 * AI Request Events
 */
export const AIRequestEvents = {
  initiated: (country: string, year: string) => {
    ReactGA4.event('ai_content_request', {
      country_name: country,
      year: year,
      request_type: 'country_info'
    });
  },

  success: (country: string, year: string, responseTime: number, contentLength: number, wordCount: number) => {
    ReactGA4.event('ai_content_generated', {
      country_name: country,
      year: year,
      response_time_ms: Math.round(responseTime),
      content_length: contentLength,
      word_count: wordCount,
      quality_rating: wordCount < 50 ? 'brief' : wordCount < 150 ? 'moderate' : 'detailed'
    });
  },

  failed: (country: string, year: string, responseTime: number, errorType?: string) => {
    ReactGA4.event('ai_request_failed', {
      country_name: country,
      year: year,
      response_time_ms: Math.round(responseTime),
      error_type: errorType || 'unknown_error'
    });
  },

  apiError: (country: string, year: string, statusCode: number, responseTime: number) => {
    ReactGA4.event('ai_request_error', {
      country_name: country,
      year: year,
      error_code: statusCode,
      response_time_ms: Math.round(responseTime),
      error_category: statusCode === 429 ? 'rate_limit' : 
                     statusCode === 401 ? 'authentication' : 
                     statusCode >= 500 ? 'server_error' : 'client_error'
    });
  },

  empty: (country: string, year: string) => {
    ReactGA4.event('ai_response_empty', {
      country_name: country,
      year: year,
      error_type: 'empty_content'
    });
  },

  formatError: (country: string, year: string) => {
    ReactGA4.event('ai_response_format_error', {
      country_name: country,
      year: year,
      error_type: 'unexpected_format'
    });
  },

  missingApiKey: (country: string, year: string) => {
    ReactGA4.event('ai_api_key_missing', {
      country_name: country,
      year: year,
      error_type: 'missing_api_key'
    });
  },
};

/**
 * Content Display Events
 */
export const AIContentEvents = {
  popupDisplayed: (provider: string, country: string) => {
    ReactGA4.event('ai_popup_displayed', {
      provider: provider,
      country_name: country,
      display_type: 'country_info'
    });
  },

  contentDisplayed: (provider: string, country: string, wordCount: number, contentLength: number) => {
    ReactGA4.event('ai_content_displayed', {
      provider: provider,
      country_name: country,
      word_count: wordCount,
      content_length: contentLength,
      content_quality: wordCount < 50 ? 'brief' : wordCount < 150 ? 'moderate' : 'detailed'
    });
  },

  errorDisplayed: (provider: string, country: string) => {
    ReactGA4.event('ai_content_error_displayed', {
      provider: provider,
      country_name: country,
      error_type: 'display_error'
    });
  },

  emptyDisplayed: (provider: string, country: string) => {
    ReactGA4.event('ai_content_empty_displayed', {
      provider: provider,
      country_name: country,
      error_type: 'empty_content'
    });
  },

  popupClosed: (provider: string, country: string) => {
    ReactGA4.event('ai_popup_closed', {
      provider: provider,
      country_name: country,
      close_type: 'user_initiated'
    });
  },
};

/**
 * Storage Events
 */
export const AIStorageEvents = {
  saved: (provider: string) => {
    ReactGA4.event('ai_provider_saved', {
      provider: provider,
      save_method: 'localStorage'
    });
  },

  saveError: (provider: string) => {
    ReactGA4.event('ai_localstorage_save_error', {
      provider: provider,
      error_type: 'unknown_error'
    });
  },

  readError: () => {
    ReactGA4.event('ai_localstorage_read_error', {
      error_type: 'unknown_error'
    });
  },
};

/**
 * Performance Tracking
 */
export const AIPerformanceEvents = {
  responseTime: (country: string, year: string, time: number, success: boolean) => {
    const action = success ? 'ai_response_time_success' : 'ai_response_time_failed';
    ReactGA4.event(action, {
      country_name: country,
      year: year,
      response_time_ms: Math.round(time),
    });
  },

  contentQuality: (country: string, year: string, wordCount: number, charCount: number) => {
    ReactGA4.event('ai_content_quality_metrics', {
      country_name: country,
      year: year,
      word_count: wordCount,
      char_count: charCount,
      words_per_char: wordCount / charCount,
    });
  },
};

/**
 * Usage Pattern Tracking
 */
export const AIUsageEvents = {
  sessionStart: (provider: string) => {
    ReactGA4.event('ai_session_started', {
      provider: provider,
      session_type: 'active_usage'
    });
  },

  featureDiscovery: (source: string) => {
    ReactGA4.event('ai_feature_discovered', {
      source: source,
    });
  },

  comparisonUsage: (fromProvider: string, toProvider: string, country: string) => {
    ReactGA4.event('ai_provider_comparison', {
      from_provider: fromProvider,
      to_provider: toProvider,
      country_name: country,
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
  ReactGA4.event(`ai_user_engagement_${engagementType}`, {
    provider: provider,
    country_name: country,
    year: year,
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