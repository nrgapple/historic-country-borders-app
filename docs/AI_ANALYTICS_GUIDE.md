# AI Feature Analytics Guide

This document provides a comprehensive overview of all Google Analytics events tracked for the AI feature in the Historic Borders app.

## Overview

The AI feature analytics tracking helps understand:
- **User Adoption**: How many users try the AI feature
- **Performance**: Response times and success rates
- **Quality**: Content metrics and user satisfaction
- **Usage Patterns**: How users interact with AI vs Wikipedia

## Event Categories

All AI-related events use the category `"AI Feature"` for easy filtering in Google Analytics.

## Tracked Events

### 1. Provider Management Events

#### `toggle_provider`
**When**: User switches between Wikipedia and AI providers
**Label**: `{from_provider}_to_{to_provider}` (e.g., "wikipedia_to_ai")
**Value**: 1
**Purpose**: Track feature adoption and switching patterns

#### `enable_ai` / `disable_ai`
**When**: AI feature is activated or deactivated
**Label**: Provider name ("ai" or "wikipedia")
**Value**: 1
**Purpose**: Track AI feature activation rates

#### `provider_restored`
**When**: User's provider preference is loaded from localStorage
**Label**: Provider name ("ai" or "wikipedia")
**Value**: 1
**Purpose**: Track returning users and preference persistence

#### `provider_default`
**When**: Default provider is used (no saved preference)
**Label**: Provider name ("wikipedia")
**Value**: 1
**Purpose**: Track new users and default behavior

#### `session_provider_active`
**When**: Provider is active during a session
**Label**: Provider name ("ai" or "wikipedia")
**Value**: 1
**Purpose**: Track session-level provider usage

### 2. AI Request Events

#### `request_initiated`
**When**: AI request starts
**Label**: `{country}_{year}` (e.g., "France_1500")
**Value**: 1
**Purpose**: Track AI usage volume and popular queries

#### `response_success`
**When**: AI request completes successfully
**Label**: `{country}_{year}`
**Value**: 1
**Purpose**: Track success rate and reliability

#### `response_time_success`
**When**: Successful AI request completes
**Label**: `{country}_{year}`
**Value**: Response time in milliseconds
**Purpose**: Track performance and user experience

#### `response_length`
**When**: Successful AI response received
**Label**: `{country}_{year}`
**Value**: Character count of response
**Purpose**: Track content quality and completeness

#### `response_word_count`
**When**: Successful AI response received
**Label**: `{country}_{year}`
**Value**: Word count of response
**Purpose**: Track content depth and detail

#### `request_failed`
**When**: AI request fails
**Label**: `{country}_{year}`
**Value**: 1
**Purpose**: Track failure rate and problematic queries

#### `response_time_failed`
**When**: Failed AI request completes
**Label**: `{country}_{year}`
**Value**: Response time in milliseconds
**Purpose**: Track performance even for failed requests

#### `error_type`
**When**: AI request fails with specific error
**Label**: `{error_type}_{country}_{year}`
**Value**: 1
**Purpose**: Track specific error patterns

#### `api_error`
**When**: Gemini API returns HTTP error
**Label**: `{status_code}_{country}_{year}`
**Value**: HTTP status code
**Purpose**: Track API-specific issues

#### `response_time_error`
**When**: API error occurs
**Label**: `{country}_{year}`
**Value**: Response time in milliseconds
**Purpose**: Track performance during errors

#### `response_empty`
**When**: AI returns empty response
**Label**: `{country}_{year}`
**Value**: 1
**Purpose**: Track content quality issues

#### `response_format_error`
**When**: AI returns unexpected response format
**Label**: `{country}_{year}`
**Value**: 1
**Purpose**: Track API compatibility issues

#### `api_key_missing`
**When**: No Gemini API key is configured
**Label**: `{country}_{year}`
**Value**: 1
**Purpose**: Track setup issues and user onboarding

### 3. Content Display Events

#### `popup_displayed`
**When**: Information popup is shown
**Label**: `{provider}_{country}` (e.g., "ai_France")
**Value**: 1
**Purpose**: Track content consumption patterns

#### `content_displayed`
**When**: Successful content is shown to user
**Label**: `{provider}_{country}`
**Value**: 1
**Purpose**: Track successful user experiences

#### `content_word_count`
**When**: Content is displayed
**Label**: `{provider}_{country}`
**Value**: Word count
**Purpose**: Compare content depth between providers

#### `content_length`
**When**: Content is displayed
**Label**: `{provider}_{country}`
**Value**: Character count
**Purpose**: Track content completeness

#### `content_error_displayed`
**When**: Error message is shown to user
**Label**: `{provider}_{country}`
**Value**: 1
**Purpose**: Track user-facing error rates

#### `content_empty_displayed`
**When**: Empty/no content message is shown
**Label**: `{provider}_{country}`
**Value**: 1
**Purpose**: Track content availability issues

#### `popup_closed`
**When**: User closes information popup
**Label**: `{provider}_{country}`
**Value**: 1
**Purpose**: Track user engagement duration

### 4. Storage Events

#### `provider_saved`
**When**: Provider preference is saved to localStorage
**Label**: Provider name ("ai" or "wikipedia")
**Value**: 1
**Purpose**: Track preference persistence success

#### `localstorage_save_error`
**When**: Failed to save provider preference
**Label**: Provider name
**Value**: 1
**Purpose**: Track storage issues

#### `localstorage_read_error`
**When**: Failed to read provider preference
**Label**: "provider_preference"
**Value**: 1
**Purpose**: Track storage compatibility issues

## Analytics Dashboard Setup

### Google Analytics 4 Configuration

1. **Navigate to Events**:
   - Go to Reports → Events → All Events
   - Filter by Event Category = "AI Feature"

2. **Create Custom Reports**:
   - AI Adoption Rate: `enable_ai` / total sessions
   - Success Rate: `response_success` / `request_initiated`
   - Average Response Time: Average of `response_time_success`
   - Content Quality: Average of `response_word_count`

3. **Set Up Conversions**:
   - Mark `enable_ai` as a conversion event
   - Track `content_displayed` for engagement

### Key Metrics to Monitor

#### Adoption Metrics
- **AI Activation Rate**: `enable_ai` events / unique users
- **Feature Discovery**: `toggle_provider` events
- **Retention**: `provider_restored` events

#### Performance Metrics
- **Success Rate**: `response_success` / `request_initiated`
- **Average Response Time**: Mean of `response_time_success`
- **Error Rate**: `request_failed` / `request_initiated`

#### Quality Metrics
- **Content Length**: Average `response_length` and `response_word_count`
- **User Satisfaction**: Low `popup_closed` rates indicate engagement
- **Comparison**: AI vs Wikipedia content metrics

#### Usage Patterns
- **Popular Queries**: Most frequent `{country}_{year}` combinations
- **Time Periods**: Which historical years are most queried
- **Geographic Interest**: Which countries are most popular

## Custom Dimensions (Optional)

Consider adding these custom dimensions for deeper insights:

1. **User Type**: New vs Returning
2. **Session Duration**: Short vs Long sessions
3. **Device Type**: Mobile vs Desktop usage
4. **Geographic Location**: User's country/region

## Troubleshooting Analytics

### Common Issues

1. **No Events Showing**:
   - Check GA4 property ID in environment variables
   - Verify events in GA4 DebugView (development mode)
   - Ensure ReactGA4 is properly initialized

2. **Missing Event Data**:
   - Check browser console for JavaScript errors
   - Verify event parameters are correctly formatted
   - Test in incognito mode to avoid ad blockers

3. **Duplicate Events**:
   - Check for multiple ReactGA4 initializations
   - Verify component re-rendering isn't causing duplicate calls

### Testing Events

Use GA4 DebugView to test events in real-time:

1. Enable debug mode: Add `?gtm_debug=1` to URL
2. Open GA4 DebugView in another tab
3. Interact with AI features
4. Verify events appear in DebugView

## Privacy Considerations

- **No Personal Data**: Only feature usage patterns are tracked
- **No API Keys**: Sensitive information is never sent to analytics
- **Anonymized**: User identities are not tracked
- **GDPR Compliant**: Only functional analytics, no personal profiling

## Data Retention

- Events are retained according to GA4 settings (default: 14 months)
- Consider exporting key metrics for long-term analysis
- Set up automated reports for regular monitoring

## Action Items

Based on analytics data, consider:

1. **Low Adoption**: Improve AI feature discoverability
2. **High Error Rates**: Investigate API reliability
3. **Slow Response Times**: Optimize API calls or add caching
4. **Poor Content Quality**: Adjust AI prompts or parameters
5. **Low Engagement**: Improve content presentation or UX

## Integration with Other Tools

Consider integrating with:
- **Hotjar/FullStory**: User session recordings for UX insights
- **Sentry**: Error tracking and performance monitoring
- **Custom Dashboards**: Real-time monitoring with Grafana/DataDog 