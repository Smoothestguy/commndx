import { ReactNode, useState } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";

interface SwipeableDismissWrapperProps {
  children: ReactNode;
  onDismiss: () => void;
  direction?: "down" | "left" | "right";
}

export function SwipeableDismissWrapper({
  children,
  onDismiss,
  direction = "down",
}: SwipeableDismissWrapperProps) {
  const isMobile = useIsMobile();
  const [isDismissing, setIsDismissing] = useState(false);

  const handleSwipe = () => {
    if (!isMobile) return;
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss();
      setIsDismissing(false);
    }, 200);
  };

  const swipeHandlers = {
    onSwipeDown: direction === "down" ? handleSwipe : undefined,
    onSwipeLeft: direction === "left" ? handleSwipe : undefined,
    onSwipeRight: direction === "right" ? handleSwipe : undefined,
  };

  const swipeRef = useSwipeGesture(swipeHandlers);

  return (
    <div
      ref={swipeRef}
      className={`transition-all duration-200 ${
        isDismissing
          ? direction === "down"
            ? "translate-y-full opacity-0"
            : direction === "left"
            ? "-translate-x-full opacity-0"
            : "translate-x-full opacity-0"
          : ""
      }`}
    >
      {children}
    </div>
  );
}
