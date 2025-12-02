import { useState, useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "./use-mobile";

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<any>;
  isRefreshing?: boolean;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh({
  onRefresh,
  isRefreshing = false,
  threshold = 80,
  maxPull = 150,
}: UsePullToRefreshOptions) {
  const isMobile = useIsMobile();
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isMobile) return;
    const scrollContainer = scrollRef.current?.closest('.overflow-y-auto') || window;
    const scrollTop = scrollContainer instanceof Window ? window.scrollY : scrollContainer.scrollTop;
    
    if (scrollTop === 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [isMobile, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || !isMobile) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    const dampedDistance = Math.min(distance * 0.5, maxPull);
    
    setPullDistance(dampedDistance);
    
    if (dampedDistance > 0) {
      e.preventDefault();
    }
  }, [isPulling, isMobile, maxPull]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile) return;
    
    if (pullDistance >= threshold) {
      onRefresh();
    }
    
    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, threshold, onRefresh, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, isMobile]);

  return {
    scrollRef,
    isPulling,
    pullDistance,
    isRefreshing,
    shouldShowIndicator: pullDistance > 20 || isRefreshing,
  };
}
