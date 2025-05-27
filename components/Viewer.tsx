import React, { useEffect, useMemo, useState } from 'react';
import {
  convertYearString,
  mapBCFormat,
} from '../util/constants';
import PersistentUIToggle from '../components/PersistentUIToggle';
import Layout from '../components/Layout';
import toast, { Toaster } from 'react-hot-toast';
import { useQuery } from '../hooks/useQuery';
import { DataProps } from '../pages';
import { useAppStateSetter, useAppStateValue } from '../hooks/useState';
import ReactGA4 from 'react-ga4';
import { toastMessages } from '../config/toasts';
import { disableBodyScroll } from 'body-scroll-lock';
import ViewerMap from './viewer/ViewerMap';
import ViewerTimeline from './viewer/ViewerTimeline';
import { isValidYear, getDefaultYear } from '../utils/queryParams';

export default function Viewer({ years, user, id, config }: DataProps) {
  const hide = useAppStateValue('hide');
  const setState = useAppStateSetter();

  const { query, setQuery, isReady } = useQuery();
  
  // Get the current year with proper validation and fallback
  const year = useMemo(() => {
    // If a year is provided in query params, try to use it even if invalid
    // This preserves the user's intent and doesn't clear the URL
    if (query.year) {
      return query.year;
    }
    // Only fall back to default if no year is provided
    return getDefaultYear(years);
  }, [query.year, years]);

  const index = useMemo(() => {
    const i = years?.findIndex((y) => y.toString() === year) ?? -1;
    return i === -1 ? 0 : i;
  }, [years, year]);

  const handleToggleUI = () => {
    setState((c) => void (c.hide = !hide));
  };

  // Set default year in URL if not present or invalid
  // Only run after router is ready to avoid clearing query params during hydration
  useEffect(() => {
    if (!isReady) return; // Wait for router to be ready
    
    // Only set default if no year is provided at all, not if it's invalid
    if (!query.year && years.length > 0) {
      const defaultYear = getDefaultYear(years);
      if (defaultYear) {
        setQuery({ year: defaultYear });
      }
    }
  }, [isReady, query.year, years, setQuery]);

  useEffect(() => {
    disableBodyScroll(document.querySelector('body') as HTMLBodyElement, {
      allowTouchMove: (el: HTMLElement | Element) => {
        return false;
      },
    });
  }, []);

  useEffect(() => {
    ReactGA4.send({
      hitType: 'pageview',
      page: `${year ? `/?year=${year}` : '/'}`,
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
            setQuery({ year: y });
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


