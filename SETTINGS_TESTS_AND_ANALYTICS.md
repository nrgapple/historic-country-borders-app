# Settings Tests and Analytics Implementation

## Overview

This document outlines the comprehensive testing suite and enhanced analytics implementation for the Historic Country Borders App settings functionality.

## 🧪 Testing Implementation

### Test Coverage Summary

We've implemented comprehensive tests for all settings-related components using Vitest and React Testing Library:

#### 1. SettingsContext Tests (`contexts/__tests__/SettingsContext.test.tsx`)
- **Default Settings**: Verifies default settings values and analytics tracking
- **Settings Updates**: Tests individual and bulk setting changes with analytics
- **LocalStorage Integration**: Tests saving/loading, error handling, and data validation
- **Reset Functionality**: Tests reset to defaults with customization tracking
- **SSR Compatibility**: Ensures server-side rendering compatibility
- **Error Handling**: Tests proper error handling outside provider context

#### 2. SettingsModal Tests (`components/__tests__/SettingsModal.test.tsx`)
- **Component Rendering**: Tests modal visibility states and UI elements
- **Text Size Settings**: Tests all size options with user interactions
- **Text Case Settings**: Tests regular/uppercase text case options
- **Country Opacity Settings**: Tests opacity grid with background colors
- **Reset Functionality**: Tests reset button behavior
- **Modal Interactions**: Tests open/close behavior and overlay clicking
- **Accessibility**: Tests ARIA labels, button roles, and keyboard navigation

#### 3. SettingsButton Tests (`components/__tests__/SettingsButton.test.tsx`)
- **Component Rendering**: Tests button rendering and icon display
- **Modal Toggle**: Tests modal opening/closing functionality
- **Analytics Tracking**: Tests comprehensive analytics events
- **Button Styling**: Tests CSS classes and accessibility attributes
- **Settings Integration**: Tests persistence and context integration

#### 4. SettingsApplier Tests (`components/__tests__/SettingsApplier.test.tsx`)
- **CSS Property Application**: Tests country opacity CSS variable setting
- **Body Class Management**: Tests text case class application
- **SSR Compatibility**: Tests undefined document handling
- **Settings Integration**: Tests response to all settings changes
- **Performance**: Tests optimal re-rendering behavior

#### 5. MapSources Tests (`components/__tests__/MapSources.test.tsx`)
- **Settings Integration**: Tests text size and case application to map labels
- **Country Opacity**: Tests opacity setting application to map layers
- **Combined Settings**: Tests multiple settings working together
- **Component Rendering**: Tests proper Source and Layer component rendering

### Test Execution

```bash
# Run all settings tests
yarn test:run contexts/__tests__/SettingsContext.test.tsx
yarn test:run components/__tests__/SettingsModal.test.tsx
yarn test:run components/__tests__/SettingsButton.test.tsx
yarn test:run components/__tests__/SettingsApplier.test.tsx
yarn test:run components/__tests__/MapSources.test.tsx

# Run all tests with coverage
yarn test:coverage
```

## 📊 Enhanced Analytics Implementation

### Analytics Categories

We've implemented comprehensive analytics tracking across multiple categories:

#### 1. Settings Category
- **Settings Usage Patterns**
  - `settings_default`: Tracks when default settings are used
  - `setting_changed`: Tracks individual setting modifications
  - `setting_transition`: Tracks setting value transitions for UX insights
  - `settings_combination_used`: Tracks popular setting combinations
  - `bulk_settings_change` vs `single_setting_change`: Tracks change patterns
  - `settings_reset`: Tracks reset to defaults usage
  - `reset_from_customized`: Tracks what settings were customized before reset

- **Modal Interaction**
  - `settings_opened`: Tracks modal opening
  - `settings_closed`: Tracks modal closing
  - `settings_opened_time`: Tracks time of day when settings are accessed
  - `modal_session_duration`: Tracks how long users spend in settings
  - `settings_engagement`: Categorizes engagement level (quick/moderate/engaged)
  - `modal_interactions`: Tracks number of interactions per session

- **Storage Operations**
  - `settings_saved`: Tracks successful localStorage saves
  - `settings_restored`: Tracks successful localStorage loads
  - `localstorage_save_error`: Tracks save errors with error types
  - `localstorage_read_error`: Tracks read errors
  - `save_performance`: Tracks localStorage save performance metrics

#### 2. Map Category
- **Settings Impact**
  - `rendered_with_settings`: Tracks map rendering with current settings
  - `country_selected_with_settings`: Tracks country selection with settings context
  - `uppercase_labels_used`: Tracks uppercase text formatting usage
  - `low_opacity_used` / `high_opacity_used`: Tracks extreme opacity preferences

#### 3. Accessibility Category
- **Accessibility Features**
  - `large_text_used`: Tracks large text setting usage for accessibility

### Analytics Event Structure

All analytics events follow a consistent structure:

```typescript
ReactGA4.event({
  category: 'Settings' | 'Map' | 'Accessibility',
  action: string,           // Specific action being tracked
  label: string,           // Additional context or value
  value: number,           // Numeric value when relevant
});
```

### Performance Metrics

- **localStorage Operations**: Tracks save/load performance
- **Session Duration**: Measures time spent in settings modal
- **Interaction Frequency**: Counts user interactions per session
- **Error Tracking**: Monitors and categorizes errors

### User Behavior Insights

The analytics provide insights into:

1. **Popular Setting Combinations**: Which settings are commonly used together
2. **Usage Patterns**: When and how often users access settings
3. **Accessibility Usage**: How accessibility features are utilized
4. **User Engagement**: How much time users spend customizing settings
5. **Error Patterns**: Common issues with localStorage or settings
6. **Performance Impact**: How settings affect application performance

## 🎯 Key Benefits

### For Development
- **Comprehensive Test Coverage**: Ensures settings functionality works correctly
- **Regression Prevention**: Tests prevent breaking changes
- **Component Integration**: Tests verify proper component interaction
- **Error Handling**: Tests ensure graceful failure scenarios

### For Product Management
- **User Behavior Data**: Understand how users interact with settings
- **Feature Usage**: Track which settings are most/least used
- **Accessibility Metrics**: Monitor accessibility feature adoption
- **Performance Insights**: Track impact of settings on app performance

### For UX/UI Design
- **Interaction Patterns**: Understand user preferences and behaviors
- **Engagement Metrics**: Measure how users engage with settings
- **Popular Configurations**: Identify common setting combinations
- **Time-based Usage**: Understand when settings are accessed

## 🔄 Continuous Improvement

The analytics data enables:

1. **Data-Driven Decisions**: Make informed changes based on usage patterns
2. **Performance Optimization**: Identify and address performance bottlenecks
3. **User Experience Enhancement**: Improve based on actual user behavior
4. **Feature Prioritization**: Focus development on most-used features
5. **Accessibility Improvements**: Enhance accessibility based on usage data

## 📝 Notes

- All analytics events are properly typed and follow consistent naming conventions
- Tests include mocking of localStorage and ReactGA4 for isolated testing
- SSR compatibility is maintained throughout the implementation
- Error handling includes both user-facing graceful degradation and developer analytics
- Performance metrics help identify optimization opportunities 