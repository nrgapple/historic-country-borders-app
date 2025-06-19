import React, { useCallback, useRef, useEffect, useState } from 'react';
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
  const [visibleYearsCount, setVisibleYearsCount] = useState(5); // Default fallback
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const currentYear = years[index];
  const formattedYear = currentYear ? convertYearString(timelineBCFormat, currentYear) : '';

  // Calculate how many years are visible in the container
  const calculateVisibleYears = useCallback(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const containerWidth = container.clientWidth;
      
      // Get the first year button to estimate width
      const firstYearButton = container.querySelector('.timeline-year-btn') as HTMLElement;
      if (firstYearButton) {
        const buttonWidth = firstYearButton.offsetWidth;
        const buttonMargin = parseInt(getComputedStyle(firstYearButton).marginRight) || 0;
        const totalButtonWidth = buttonWidth + buttonMargin;
        
        // Calculate how many buttons fit in the container width
        const visibleCount = Math.floor(containerWidth / totalButtonWidth);
        setVisibleYearsCount(Math.max(1, visibleCount - 1)); // Subtract 1 for partial visibility
      }
    }
  }, []);

  // Check if there are more years to scroll to in each direction
  const updateScrollButtonStates = useCallback(() => {
    if (!scrollContainerRef.current) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    
    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const yearButtons = container.querySelectorAll('.timeline-year-btn');
    
    let hasHiddenLeft = false;
    let hasHiddenRight = false;
    
    // Check if there are any years hidden to the left or right
    yearButtons.forEach((button) => {
      const buttonRect = button.getBoundingClientRect();
      if (buttonRect.left < containerRect.left) {
        hasHiddenLeft = true;
      }
      if (buttonRect.right > containerRect.right) {
        hasHiddenRight = true;
      }
    });
    
    setCanScrollLeft(hasHiddenLeft);
    setCanScrollRight(hasHiddenRight);
  }, []);

  // Calculate visible years on mount and window resize
  useEffect(() => {
    calculateVisibleYears();
    updateScrollButtonStates();
    
    const handleResize = () => {
      calculateVisibleYears();
      updateScrollButtonStates();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateVisibleYears, updateScrollButtonStates]);

  // Add scroll event listener to update button states when manually scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateScrollButtonStates();
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updateScrollButtonStates]);

  // Recalculate when years change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateVisibleYears();
      updateScrollButtonStates();
    }, 100); // Small delay to ensure DOM is updated
    
    return () => clearTimeout(timeoutId);
  }, [years, calculateVisibleYears, updateScrollButtonStates]);

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
    ReactGA4.event('year_navigate', {
      target_year: years[yearIndex],
      current_year: currentYear,
      navigation_method: 'timeline_click',
      year_index: yearIndex,
      year_change: Math.abs(years[yearIndex] - currentYear)
    });
  }, [onChange, years, currentYear]);

  const goToPrevious = useCallback(() => {
    // Find the leftmost visible year and scroll to show previous page
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Find the first fully visible year button
      const yearButtons = container.querySelectorAll('.timeline-year-btn');
      let leftmostVisibleIndex = -1;
      
      yearButtons.forEach((button, i) => {
        const buttonRect = button.getBoundingClientRect();
        if (buttonRect.left >= containerRect.left && leftmostVisibleIndex === -1) {
          leftmostVisibleIndex = i;
        }
      });
      
      if (leftmostVisibleIndex > 0) {
        // Scroll to show the previous page, but keep at least one year visible for continuity
        const scrollAmount = Math.max(1, visibleYearsCount - 1);
        const targetIndex = Math.max(0, leftmostVisibleIndex - scrollAmount);
        
        // Scroll the target year into view without changing the selected year
        const targetButton = yearButtons[targetIndex] as HTMLElement;
        if (targetButton) {
          targetButton.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'start'
          });
        }
        
        ReactGA4.event('timeline_scroll', {
          direction: 'previous',
          from_index: leftmostVisibleIndex,
          to_index: targetIndex,
          years_scrolled: leftmostVisibleIndex - targetIndex,
          current_selected_year: currentYear
        });
      }
    }
  }, [years, currentYear, visibleYearsCount]);

  const goToNext = useCallback(() => {
    // Find the rightmost visible year and scroll to show next page
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Find the last fully visible year button
      const yearButtons = container.querySelectorAll('.timeline-year-btn');
      let rightmostVisibleIndex = -1;
      
      yearButtons.forEach((button, i) => {
        const buttonRect = button.getBoundingClientRect();
        if (buttonRect.right <= containerRect.right) {
          rightmostVisibleIndex = i;
        }
      });
      
      if (rightmostVisibleIndex < years.length - 1) {
        // Scroll to show the next page, but keep at least one year visible for continuity
        const scrollAmount = Math.max(1, visibleYearsCount - 1);
        const targetIndex = Math.min(years.length - 1, rightmostVisibleIndex + scrollAmount);
        
        // Scroll the target year into view without changing the selected year
        const targetButton = yearButtons[targetIndex] as HTMLElement;
        if (targetButton) {
          targetButton.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'end'
          });
        }
        
        ReactGA4.event('timeline_scroll', {
          direction: 'next',
          from_index: rightmostVisibleIndex,
          to_index: targetIndex,
          years_scrolled: targetIndex - rightmostVisibleIndex,
          current_selected_year: currentYear
        });
      }
    }
  }, [years, currentYear, visibleYearsCount]);

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
          disabled={!canScrollLeft}
          style={{ 
            color: primaryColor,
            borderColor: primaryColor,
          }}
          aria-label="Previous page of years"
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
          disabled={!canScrollRight}
          style={{ 
            color: primaryColor,
            borderColor: primaryColor,
          }}
          aria-label="Next page of years"
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
