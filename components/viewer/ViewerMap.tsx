import React from 'react';
import MapContainer from '../MapContainer';
import { ConfigType } from '../../util/types';
import { useAppStateValue } from '../../hooks/useState';
import ViewerFooter from './ViewerFooter';


interface ViewerMapProps {
  user: string;
  id: string;
  config: ConfigType;
  year: string;
  onInteraction: () => void;
}

export default function ViewerMap({ 
  user, 
  id, 
  config, 
  year, 
  onInteraction 
}: ViewerMapProps) {
  const hide = useAppStateValue('hide');
  
  return (
    <div className={`${hide ? 'app-large' : 'app'}`} onClick={onInteraction}>
      <MapContainer year={year} user={user} id={id} />
      <ViewerFooter config={config} />
    </div>
  );
} 