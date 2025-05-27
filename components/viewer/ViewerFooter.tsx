import React from 'react';
import Footer from '../Footer';
import { ConfigType } from '../../util/types';
import { useAppStateValue } from '../../hooks/useState';

interface ViewerFooterProps {
  config: ConfigType;
}

export default function ViewerFooter({ config }: ViewerFooterProps) {
  const hide = useAppStateValue('hide');

  return (
    <>
      {!hide && (
        <Footer
          dataUrl={`https://github.com/aourednik/historical-basemaps`}
          lastCommit={
            config.commitDate ? new Date(config.commitDate) : undefined
          }
          discussionUrl={`https://github.com/nrgapple/historic-country-borders-app/discussions`}
        />
      )}
    </>
  );
} 