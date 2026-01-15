import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, HardHat, Store, ArrowRightLeft } from "lucide-react";

interface PortalSwitcherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const portals = [
  {
    key: "1",
    name: "Admin Dashboard",
    description: "Main application dashboard",
    icon: Building2,
    path: "/auth",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
  },
  {
    key: "2",
    name: "Personnel Portal",
    description: "For employees & field staff",
    icon: HardHat,
    path: "/portal/login",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
  },
  {
    key: "3",
    name: "Vendor Portal",
    description: "For vendors & suppliers",
    icon: Store,
    path: "/vendor/login",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
  },
];

export function PortalSwitcherModal({ open, onOpenChange }: PortalSwitcherModalProps) {
  const navigate = useNavigate();

  const handlePortalSelect = useCallback((path: string) => {
    onOpenChange(false);
    navigate(path);
  }, [navigate, onOpenChange]);

  // Handle keyboard shortcuts for quick selection (1, 2, 3)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const portal = portals.find((p) => p.key === e.key);
      if (portal) {
        e.preventDefault();
        handlePortalSelect(portal.path);
      }
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handlePortalSelect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ArrowRightLeft className="h-5 w-5" />
            Switch Portal
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <button
                key={portal.key}
                onClick={() => handlePortalSelect(portal.path)}
                className={`w-full flex items-center gap-4 p-4 rounded-lg border border-border transition-all ${portal.bgColor}`}
              >
                <div className={`p-3 rounded-lg ${portal.bgColor}`}>
                  <Icon className={`h-6 w-6 ${portal.color}`} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{portal.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {portal.description}
                  </div>
                </div>
                <kbd className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded border bg-muted font-mono text-sm">
                  {portal.key}
                </kbd>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Cancel
          </Button>
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">1</kbd>,{" "}
            <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">2</kbd>, or{" "}
            <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">3</kbd> to quick select
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

