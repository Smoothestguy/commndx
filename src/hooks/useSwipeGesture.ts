import { useEffect, useRef, useCallback } from "react";

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  velocityThreshold?: number;
  edgeThreshold?: number; // Distance from screen edge to allow navigation even in scrollable areas
}

// Check if element or any parent has horizontal scroll capability
const isInsideScrollableX = (element: HTMLElement | null): boolean => {
  let current: HTMLElement | null = element;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowX = style.overflowX;
    const hasOverflowScroll = overflowX === 'auto' || overflowX === 'scroll';
    const hasScrollableContent = current.scrollWidth > current.clientWidth;
    
    if (hasOverflowScroll && hasScrollableContent) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  velocityThreshold = 0.5,
  edgeThreshold = 30, // Allow navigation from screen edges even in scrollable areas
}: SwipeGestureOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const touchTarget = useRef<HTMLElement | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    touchTarget.current = e.target as HTMLElement;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const endTime = Date.now();

    const deltaX = endX - startX.current;
    const deltaY = endY - startY.current;
    const deltaTime = endTime - startTime.current;

    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Check if this is a horizontal swipe
    const isHorizontalSwipe = absX > absY && (absX > threshold || velocityX > velocityThreshold);
    
    if (isHorizontalSwipe) {
      // Check if touch started inside a horizontally scrollable container
      const inScrollable = isInsideScrollableX(touchTarget.current);
      
      // Check if swipe started from screen edge (escape hatch for navigation)
      const screenWidth = window.innerWidth;
      const startedFromLeftEdge = startX.current < edgeThreshold;
      const startedFromRightEdge = startX.current > screenWidth - edgeThreshold;
      const startedFromEdge = startedFromLeftEdge || startedFromRightEdge;
      
      // If inside scrollable area and not from edge, let browser handle scroll
      if (inScrollable && !startedFromEdge) {
        return;
      }
      
      // Trigger navigation
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    // Vertical swipe (must be more vertical than horizontal)
    else if (absY > absX && (absY > threshold || velocityY > velocityThreshold)) {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown();
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp();
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocityThreshold, edgeThreshold]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return elementRef;
}
