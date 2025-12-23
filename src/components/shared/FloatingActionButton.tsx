import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: ReactNode;
  label?: string;
  className?: string;
}

export function FloatingActionButton({ 
  onClick, 
  icon, 
  label,
  className 
}: FloatingActionButtonProps) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <Button
      onClick={onClick}
      variant="glow"
      size="lg"
      className={cn(
        "fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg",
        "animate-fade-in",
        label && "w-auto px-5",
        className
      )}
    >
      {icon}
      {label && <span className="ml-2">{label}</span>}
    </Button>
  );
}
