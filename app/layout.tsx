import '../styles/index.css';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';
import { QueryProvider } from '../hooks/useQuery';
import { StateProvider } from '../hooks/useState';
import { InfoProviderProvider } from '../contexts/InfoProviderContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import { CompareProvider } from '../contexts/CompareContext';
import SettingsApplier from '../components/SettingsApplier';
import CompactFeedbackWidget from '../components/CompactFeedbackWidget';
import ClientLayout from './client-layout';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Historic Country Borders',
  description: 'Explore historical country borders through time with an interactive map',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<div>Loading...</div>}>
          <QueryProvider>
            <StateProvider>
              <InfoProviderProvider>
                <SettingsProvider>
                  <CompareProvider>
                    <SettingsApplier />
                    <ClientLayout>
                      {children}
                    </ClientLayout>
                    <SpeedInsights />
                  </CompareProvider>
                </SettingsProvider>
              </InfoProviderProvider>
            </StateProvider>
          </QueryProvider>
        </Suspense>
      </body>
    </html>
  );
} 