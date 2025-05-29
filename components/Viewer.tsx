import React, { useEffect, useMemo, useState } from 'react';
import {
  convertYearString,
  mapBCFormat,
} from '../util/constants';
import PersistentUIToggle from '../components/PersistentUIToggle';
import SettingsButton from '../components/SettingsButton';
import Layout from '../components/Layout';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery } from '../hooks/useQuery';
import { useYearRouting } from '../hooks/useYearRouting';
import { useAppStateSetter, useAppStateValue } from '../hooks/useState';
import ReactGA4 from 'react-ga4';
import { toastMessages } from '../config/toasts';
import ViewerMap from './viewer/ViewerMap';
import ViewerTimeline from './viewer/ViewerTimeline';

// Helper function to get a random year from the available years
const getRandomYear = (years: (string | number)[]): string => {
  if (!years || years.length === 0) return '';
  const randomIndex = Math.floor(Math.random() * years.length);
  return years[randomIndex].toString();
};

export interface DataProps {
  years: number[];
  user: string;
  id: string;
  config: any;
  currentYear?: string;
}

export default function Viewer({ years, user, id, config, currentYear }: DataProps) {
  const hide = useAppStateValue('hide');
  const setState = useAppStateSetter();

  // Use year routing instead of query parameters
  const { currentYear: routedYear, setYear, isReady } = useYearRouting(currentYear);
  
  // Still use query for map state (lng, lat, zoom)
  const { query, updateQuery } = useQuery();
  
  // Get the current year with proper validation and fallback
  const year = useMemo(() => {
    // If we have a routed year (from URL path), use it
    if (routedYear) {
      return routedYear;
    }
    // Don't use random during server-side rendering to avoid hydration mismatch
    // The useEffect below will handle setting a random year on the client
    return years?.[0]?.toString() || '';
  }, [routedYear, years]);

  const index = useMemo(() => {
    const i = years?.findIndex((y) => y.toString() === year) ?? -1;
    return i === -1 ? 0 : i;
  }, [years, year]);

  const handleToggleUI = () => {
    setState((c) => void (c.hide = !hide));
  };

  // Set random year in URL if not present
  // Only run after router is ready to avoid clearing query params during hydration
  useEffect(() => {
    if (!isReady) return; // Wait for router to be ready
    
    // Only set random if no year is provided at all
    if (!routedYear && years.length > 0) {
      const randomYear = getRandomYear(years);
      if (randomYear) {
        setYear(randomYear);
      }
    }
  }, [isReady, routedYear, years, setYear]);

  // The scroll lock is now handled in _app.tsx globally
  // No need for additional scroll locking here

  useEffect(() => {
    ReactGA4.send({
      hitType: 'pageview',
      page: `${year ? `/year/${year}` : '/'}`,
      title: `${year ? `Year ${year}` : 'Home'}`,
    });
  }, [year]);

  useEffect(() => {
    toastMessages.forEach(({ message, opts }) => {
      toast(message, opts);
    });
  }, []);

  if (!(years && user && id && config))
    return <div>Not a valid timeline. Check your url.</div>;

  return (
    <>
      <Layout title={config.name} url={`https://historyborders.app`}>
        <ViewerTimeline
          index={index}
          years={years}
          onChange={(y: string) => {
            setYear(y);
            ReactGA4.event({
              category: 'Timeline',
              action: 'Year Changed',
              label: `Year ${y}`,
            });
          }}
        />
        <ViewerMap
          user={user}
          id={id}
          config={config}
          year={convertYearString(mapBCFormat, years[index])}
          onInteraction={() => {
            ReactGA4.event({
              category: 'Map',
              action: 'Interaction',
              label: `Year ${years[index]}`,
            });
          }}
        />
      </Layout>
      <PersistentUIToggle 
        isUIHidden={hide}
        onToggle={handleToggleUI}
      />
      <SettingsButton />
      <Toaster
        toastOptions={{
          className: 'react-hot-toast',
          style: {
            background: 'rgba(245, 245, 220, 0.95)',
            border: '2px solid #8B4513',
            borderRadius: '4px',
            color: '#654321',
            fontFamily: "'Times New Roman', serif",
            fontSize: '12px',
            fontWeight: 'normal',
            boxShadow: '2px 2px 8px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            padding: '12px 16px',
            maxWidth: '350px',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.1)',
            lineHeight: '1.4',
          },
          success: {
            className: 'react-hot-toast success',
            style: {
              background: 'rgba(240, 248, 240, 0.95)',
              borderColor: '#5A7C5A',
              color: '#2D4A2D',
            },
          },
          error: {
            className: 'react-hot-toast error',
            style: {
              background: 'rgba(248, 240, 240, 0.95)',
              borderColor: '#8B4A4A',
              color: '#5A2D2D',
            },
          },
          loading: {
            className: 'react-hot-toast loading',
            style: {
              background: 'rgba(245, 245, 220, 0.95)',
              borderColor: '#8B4513',
              color: '#654321',
            },
          },
        }}
      />
    </>
  );
}


