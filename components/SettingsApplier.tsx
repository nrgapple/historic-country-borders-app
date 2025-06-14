'use client';

import { useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';

export default function SettingsApplier() {
  const { settings } = useSettings();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Apply country opacity to CSS custom property
    document.documentElement.style.setProperty('--country-opacity', settings.countryOpacity.toString());

  }, [settings]);

  return null; // This component doesn't render anything
} 