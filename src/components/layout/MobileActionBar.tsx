import { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface ActionButton {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "glow" | "destructive" | "success";
  loading?: boolean;
}

interface MobileActionBarProps {
  primaryActions: ActionButton[]; // Max 3 recommended
  secondaryActions?: ActionButton[];
  className?: string;
}

export function MobileActionBar({
  primaryActions,
  secondaryActions = [],
  className,
}: MobileActionBarProps) {
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const displayActions = primaryActions.slice(0, 2); // Show max 2 primary actions on bar
  const hasMoreActions = primaryActions.length > 2 || secondaryActions.length > 0;
  const moreActions = [
    ...primaryActions.slice(2),
    ...secondaryActions,
  ];

  return (
    <div
      className={cn(
        "fixed bottom-16 left-0 right-0 z-40",
        "glass border-t border-border/50 safe-area-bottom",
        "animate-slide-up",
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        {displayActions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || "default"}
            className="flex-1"
            onClick={action.onClick}
            disabled={action.loading}
          >
            {action.icon}
            <span className="ml-2">{action.label}</span>
          </Button>
        ))}
        
        {hasMoreActions && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="glass">
              <SheetHeader>
                <SheetTitle>More Actions</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-2 mt-6">
                {moreActions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant || "outline"}
                    className="w-full justify-start"
                    onClick={action.onClick}
                    disabled={action.loading}
                  >
                    {action.icon}
                    <span className="ml-2">{action.label}</span>
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
