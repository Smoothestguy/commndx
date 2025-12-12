import { useState, useEffect, useCallback, useRef } from "react";

interface DraggableOptions {
  initialPosition?: { x: number; y: number };
  storageKey?: string;
  bounds?: { top?: number; right?: number; bottom?: number; left?: number };
}

interface Position {
  x: number;
  y: number;
}

export function useDraggable(options: DraggableOptions = {}) {
  const { storageKey, bounds = {} } = options;
  const { top = 0, right = 0, bottom = 0, left = 0 } = bounds;

  const getDefaultPosition = useCallback((): Position => {
    return {
      x: typeof window !== "undefined" ? window.innerWidth - 80 : 300,
      y: 80, // Default to top area for better visibility
    };
  }, []);

  const isValidPosition = useCallback((x: number, y: number): boolean => {
    if (typeof window === "undefined") return false;
    return (
      typeof x === 'number' &&
      typeof y === 'number' &&
      !isNaN(x) &&
      !isNaN(y) &&
      x >= 0 &&
      x <= window.innerWidth - 56 &&
      y >= 0 &&
      y <= window.innerHeight - 56
    );
  }, []);

  const [position, setPosition] = useState<Position>(() => {
    const defaultPosition = getDefaultPosition();

    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (isValidPosition(parsed.x, parsed.y)) {
            return parsed;
          }
          // Invalid position, remove from storage
          localStorage.removeItem(storageKey);
        } catch {
          localStorage.removeItem(storageKey);
        }
      }
    }
    return defaultPosition;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const positionRef = useRef<Position>(position);
  const hasDraggedRef = useRef(false);

  // Keep positionRef in sync
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const constrainPosition = useCallback(
    (x: number, y: number): Position => {
      const maxX = window.innerWidth - 56 - right;
      const maxY = window.innerHeight - 56 - bottom;
      return {
        x: Math.max(left, Math.min(x, maxX)),
        y: Math.max(top, Math.min(y, maxY)),
      };
    },
    [top, right, bottom, left]
  );

  // Handle window resize to keep button visible
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const constrained = constrainPosition(prev.x, prev.y);
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(constrained));
        }
        return constrained;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainPosition, storageKey]);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragStartRef.current) return;

      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      // Mark as dragged if moved more than 5px
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDraggedRef.current = true;
      }

      const newPosition = constrainPosition(
        positionRef.current.x + deltaX,
        positionRef.current.y + deltaY
      );

      setPosition(newPosition);
      positionRef.current = newPosition;
      dragStartRef.current = { x: clientX, y: clientY };
    },
    [constrainPosition]
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;

    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(positionRef.current));
    }

    // Reset hasDragged after a short delay to allow click handler to check it
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 100);
  }, [storageKey]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
        e.preventDefault(); // Prevent page scrolling on mobile
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        handleEnd();
      }
    };

    const handleTouchEnd = () => {
      if (isDragging) {
        handleEnd();
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      hasDraggedRef.current = false;
      dragStartRef.current = { x: clientX, y: clientY };
      setIsDragging(true);
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleStart]
  );

  return {
    position,
    isDragging,
    hasDragged: () => hasDraggedRef.current,
    handleMouseDown,
    handleTouchStart,
  };
}
