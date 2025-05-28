import { useEffect, useCallback } from 'react';

interface ScrollLockOptions {
  allowedSelectors?: string[];
}

export function useScrollLock(isLocked: boolean = true, options: ScrollLockOptions = {}) {
  const { allowedSelectors = [] } = options;

  const lockScroll = useCallback(() => {
    // Store original body styles
    const body = document.body;
    const scrollY = window.scrollY;
    
    // Apply scroll lock styles
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    body.style.width = '100%';
    
    // Store scroll position for restoration
    body.setAttribute('data-scroll-y', scrollY.toString());
    
    // Allow specific elements to scroll
    allowedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const element = el as HTMLElement;
        element.style.touchAction = 'pan-y';
        element.style.overscrollBehavior = 'contain';
        (element.style as any).webkitOverflowScrolling = 'touch';
      });
    });
  }, [allowedSelectors]);

  const unlockScroll = useCallback(() => {
    const body = document.body;
    const scrollY = body.getAttribute('data-scroll-y');
    
    // Restore original styles
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.overflow = '';
    body.style.width = '';
    
    // Restore scroll position
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY, 10));
      body.removeAttribute('data-scroll-y');
    }
    
    // Reset touch action on allowed elements
    allowedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const element = el as HTMLElement;
        element.style.touchAction = '';
        element.style.overscrollBehavior = '';
        (element.style as any).webkitOverflowScrolling = '';
      });
    });
  }, [allowedSelectors]);

  useEffect(() => {
    if (isLocked) {
      lockScroll();
    } else {
      unlockScroll();
    }

    // Cleanup on unmount
    return () => {
      if (isLocked) {
        unlockScroll();
      }
    };
  }, [isLocked, lockScroll, unlockScroll]);

  return { lockScroll, unlockScroll };
}

// Alternative hook for allowing scroll on specific elements
export function useAllowScroll(selector: string, isActive: boolean = true) {
  useEffect(() => {
    if (!isActive) return;

    const elements = document.querySelectorAll(selector);
    
    elements.forEach(el => {
      const element = el as HTMLElement;
      
      // Store original styles
      const originalTouchAction = element.style.touchAction;
      const originalOverscrollBehavior = element.style.overscrollBehavior;
      const originalWebkitOverflowScrolling = (element.style as any).webkitOverflowScrolling;
      
      // Apply scroll-friendly styles
      element.style.touchAction = 'pan-y';
      element.style.overscrollBehavior = 'contain';
      (element.style as any).webkitOverflowScrolling = 'touch';
      
      // Store original values for cleanup
      element.setAttribute('data-original-touch-action', originalTouchAction);
      element.setAttribute('data-original-overscroll-behavior', originalOverscrollBehavior);
      element.setAttribute('data-original-webkit-overflow-scrolling', originalWebkitOverflowScrolling);
    });

    return () => {
      elements.forEach(el => {
        const element = el as HTMLElement;
        
        // Restore original styles
        element.style.touchAction = element.getAttribute('data-original-touch-action') || '';
        element.style.overscrollBehavior = element.getAttribute('data-original-overscroll-behavior') || '';
        (element.style as any).webkitOverflowScrolling = element.getAttribute('data-original-webkit-overflow-scrolling') || '';
        
        // Clean up data attributes
        element.removeAttribute('data-original-touch-action');
        element.removeAttribute('data-original-overscroll-behavior');
        element.removeAttribute('data-original-webkit-overflow-scrolling');
      });
    };
  }, [selector, isActive]);
} 