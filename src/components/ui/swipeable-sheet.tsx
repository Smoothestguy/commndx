import * as React from "react";
import { Sheet, SheetContent, SheetClose, SheetPortal } from "@/components/ui/sheet";
import { SwipeableDismissWrapper } from "@/components/shared/SwipeableDismissWrapper";
import { useIsMobile } from "@/hooks/use-mobile";

interface SwipeableSheetProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SwipeableSheet({
  children,
  open,
  onOpenChange,
}: SwipeableSheetProps) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        {isMobile ? (
          <SwipeableDismissWrapper onDismiss={() => onOpenChange(false)}>
            <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
              {/* Drag Handle */}
              <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mb-4" />
              {children}
            </SheetContent>
          </SwipeableDismissWrapper>
        ) : (
          <SheetContent>{children}</SheetContent>
        )}
      </SheetPortal>
    </Sheet>
  );
}
