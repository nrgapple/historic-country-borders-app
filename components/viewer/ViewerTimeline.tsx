import React from 'react';
import Timeline from '../Timeline';
import { useAppStateValue } from '../../hooks/useState';

interface ViewerTimelineProps {
  index: number;
  years: number[];
  onChange: (year: string) => void;
}

export default function ViewerTimeline({ 
  index, 
  years, 
  onChange 
}: ViewerTimelineProps) {
  const hide = useAppStateValue('hide');
  
  return (
    <>
      {!hide && (
        <div className="timeline-container">
          <Timeline
            index={index}
            onChange={(v) => {
              const year = years[v].toString();
              onChange(year);
            }}
            years={years}
          />
        </div>
      )}
    </>
  );
} 