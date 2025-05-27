import React, { useCallback, useRef, useEffect } from 'react';
import { convertYearString, timelineBCFormat } from '../util/constants';
import ReactGA4 from 'react-ga4';

interface TimelineProps {
  index: number;
  onChange: (value: number) => void;
  years: number[];
  globe?: boolean;
}

export default function Timeline({
  index,
  onChange,
  years,
  globe,
}: TimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const currentYear = years[index];
  const formattedYear = convertYearString(timelineBCFormat, currentYear);

  // Scroll active item into view when index changes
  useEffect(() => {
    if (activeItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeItem = activeItemRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      
      // Check if item is outside visible area
      if (itemRect.left < containerRect.left || itemRect.right > containerRect.right) {
        activeItem.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [index]);

  const handleYearClick = useCallback((yearIndex: number) => {
    onChange(yearIndex);
    ReactGA4.event({
      category: 'UI',
      action: `clicked timeline: ${years[yearIndex]}`,
      label: 'timeline',
    });
  }, [onChange, years]);

  const goToPrevious = useCallback(() => {
    if (index > 0) {
      onChange(index - 1);
    }
  }, [index, onChange]);

  const goToNext = useCallback(() => {
    if (index < years.length - 1) {
      onChange(index + 1);
    }
  }, [index, years.length, onChange]);

  const primaryColor = !globe ? '#6930c3' : '#64dfdf';
  const secondaryColor = !globe ? '#64dfdf' : '#6930c3';

  return (
    <div className="timeline-discrete">
      {/* Navigation Controls */}
      <div className="timeline-nav-container">
        {/* Previous Button */}
        <button
          className="timeline-nav-btn timeline-nav-prev"
          onClick={goToPrevious}
          disabled={index === 0}
          style={{ 
            color: primaryColor,
            borderColor: primaryColor,
          }}
          aria-label="Previous year"
        >
          ◀
        </button>

        {/* Scrollable Years Container */}
        <div 
          className="timeline-years-container"
          ref={scrollContainerRef}
        >
          <div className="timeline-years-scroll">
            {years.map((year, i) => {
              const isActive = i === index;
              const yearLabel = convertYearString(timelineBCFormat, year);
              
              return (
                <button
                  key={i}
                  ref={isActive ? activeItemRef : null}
                  className={`timeline-year-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleYearClick(i)}
                  style={{
                    color: isActive ? '#654321' : '#8B4513',
                    borderColor: isActive ? '#654321' : '#8B4513',
                    backgroundColor: isActive ? '#DEB887' : '#F5F5DC',
                    borderWidth: isActive ? '3px' : '2px',
                  }}
                  aria-label={`Go to year ${yearLabel}`}
                >
                  {yearLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Next Button */}
        <button
          className="timeline-nav-btn timeline-nav-next"
          onClick={goToNext}
          disabled={index === years.length - 1}
          style={{ 
            color: primaryColor,
            borderColor: primaryColor,
          }}
          aria-label="Next year"
        >
          ▶
        </button>
      </div>

      {/* Current Year Display */}
      <div 
        className="timeline-current-year"
        style={{ 
          color: primaryColor,
          textShadow: `0px 0px 4px ${secondaryColor}`,
        }}
      >
        {formattedYear}
      </div>
    </div>
  );
}
