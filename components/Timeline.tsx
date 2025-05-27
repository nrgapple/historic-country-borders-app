import React, { useCallback, useRef, useEffect } from 'react';
import { convertYearString, timelineBCFormat } from '../util/constants';
import ReactGA4 from 'react-ga4';

interface TimelineProps {
  index: number;
  onChange: (value: number) => void;
  years: number[];
}

export default function Timeline({
  index,
  onChange,
  years,
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

  const primaryColor = '#6930c3';
  const secondaryColor = '#64dfdf';

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
          <span className="timeline-nav-arrow">‹</span>
        </button>

        {/* Scrollable Years Container */}
        <div 
          className="timeline-years-container"
          ref={scrollContainerRef}
        >
          <div className="timeline-years-scroll">
            {years.map((year, i) => {
              const isActive = i === index;
              const isPast = i < index;
              const yearLabel = convertYearString(timelineBCFormat, year);
              
              let buttonClass = 'timeline-year-btn';
              if (isActive) buttonClass += ' active';
              if (isPast) buttonClass += ' past';
              
              return (
                <button
                  key={i}
                  ref={isActive ? activeItemRef : null}
                  className={buttonClass}
                  onClick={() => handleYearClick(i)}
                  style={{
                    color: isActive ? '#654321' : isPast ? '#5A4A3A' : '#8B4513',
                    borderColor: isActive ? '#654321' : isPast ? '#5A4A3A' : '#8B4513',
                    backgroundColor: isActive ? '#DEB887' : isPast ? '#D2B48C' : '#F5F5DC',
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
          <span className="timeline-nav-arrow">›</span>
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
