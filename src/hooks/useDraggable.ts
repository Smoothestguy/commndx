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

  const [position, setPosition] = useState<Position>(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Invalid JSON, use default
        }
      }
    }
    // Default to bottom-right corner
    return {
      x: typeof window !== "undefined" ? window.innerWidth - 80 : 0,
      y: typeof window !== "undefined" ? window.innerHeight - 100 : 0,
    };
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
      const maxX = window.innerWidth - 56 - right; // 56px button width
      const maxY = window.innerHeight - 56 - bottom; // 56px button height
      return {
        x: Math.max(left, Math.min(x, maxX)),
        y: Math.max(top, Math.min(y, maxY)),
      };
    },
    [top, right, bottom, left]
  );

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
