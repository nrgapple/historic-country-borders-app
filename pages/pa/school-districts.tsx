import React from 'react';
import Layout from '../../components/Layout';
import PASchoolDistrictsMapContainer from '../../components/PASchoolDistrictsMapContainer';
import PersistentUIToggle from '../../components/PersistentUIToggle';
import SettingsButton from '../../components/SettingsButton';
import { useAppStateValue, useAppStateSetter } from '../../hooks/useState';
import { Toaster } from 'react-hot-toast';
import ReactGA4 from 'react-ga4';
import { useEffect } from 'react';

const SchoolDistrictsPage = () => {
  const hide = useAppStateValue('hide');
  const setState = useAppStateSetter();

  const handleToggleUI = () => {
    setState((c) => void (c.hide = !hide));
  };

  useEffect(() => {
    ReactGA4.send({
      hitType: 'pageview',
      page: '/pa/school-districts',
      title: 'PA School Districts',
    });
  }, []);

  return (
    <>
      <Layout 
        title="Pennsylvania School Districts" 
        url="https://historicborders.app/pa/school-districts"
        description="Interactive map of Pennsylvania school districts for 2025. Explore all 500 school districts across the state with detailed information."
      >
        <div className={hide ? 'app-large' : 'app'}>
          <PASchoolDistrictsMapContainer />
        </div>
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
};

export default SchoolDistrictsPage;

