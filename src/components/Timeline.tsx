import React from 'react';
//@ts-ignore
import HorizontalTimeline from 'react-horizontal-timeline';
import { convertYearString, dates, timelineBCFormat } from '../util/constants';

interface TimelineProps {
  index: number;
  onChange: (value: number) => void;
}

const Timeline = ({ index, onChange }: TimelineProps) => (
  <div className="timeline">
    <div
      style={{
        width: '100%',
        height: '100px',
        fontSize: '15px',
      }}
      className="timeline"
    >
      <HorizontalTimeline
        styles={{
          background: '#252525',
          foreground: '#64dfdf',
          outline: '#6930c3',
        }}
        index={index}
        indexClick={(newIndex: number) => {
          onChange(newIndex);
        }}
        getLabel={(date: any) =>
          convertYearString(timelineBCFormat, new Date(date, 0).getFullYear())
        }
        values={dates}
      />
    </div>
  </div>
);

export default Timeline;
