import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  Receipt, 
  FolderPlus, 
  UserPlus, 
  Clock, 
  Users 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EnhancedTimeEntryForm } from "@/components/time-tracking/EnhancedTimeEntryForm";

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
  action: () => void;
}

export function QuickActionsRow() {
  const navigate = useNavigate();
  const [timeEntryOpen, setTimeEntryOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  // Detect platform for keyboard shortcut hints
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger with Cmd (Mac) or Ctrl (Windows/Linux)
      if (!e.metaKey && !e.ctrlKey) return;
      
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'e':
          e.preventDefault();
          navigate("/estimates/new");
          break;
        case 'i':
          e.preventDefault();
          navigate("/invoices/new");
          break;
        case 'p':
          e.preventDefault();
          navigate("/projects?action=add");
          break;
        case 'c':
          e.preventDefault();
          navigate("/customers?action=add");
          break;
        case 'l':
          e.preventDefault();
          setTimeEntryOpen(true);
          break;
        case 'a':
          e.preventDefault();
          navigate("/personnel?action=add");
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const actions: QuickAction[] = [
    {
      icon: FileText,
      label: "New Estimate",
      shortcut: "E",
      action: () => navigate("/estimates/new"),
    },
    {
      icon: Receipt,
      label: "New Invoice",
      shortcut: "I",
      action: () => navigate("/invoices/new"),
    },
    {
      icon: FolderPlus,
      label: "New Project",
      shortcut: "P",
      action: () => navigate("/projects?action=add"),
    },
    {
      icon: UserPlus,
      label: "New Customer",
      shortcut: "C",
      action: () => navigate("/customers?action=add"),
    },
    {
      icon: Clock,
      label: "Log Time",
      shortcut: "L",
      action: () => setTimeEntryOpen(true),
    },
    {
      icon: Users,
      label: "Add Personnel",
      shortcut: "A",
      action: () => navigate("/personnel?action=add"),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            className={cn(
              "h-auto py-3 px-3 flex flex-col items-center gap-1.5",
              "bg-card hover:bg-muted/50 border-border/50",
              "transition-all duration-200"
            )}
            onClick={action.action}
          >
            <action.icon className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{action.label}</span>
            <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center justify-center rounded bg-muted text-[10px] font-mono text-muted-foreground">
              {isMac ? "⌘" : "Ctrl+"}{action.shortcut}
            </kbd>
          </Button>
        ))}
      </div>

      {/* Time Entry Dialog */}
      <EnhancedTimeEntryForm open={timeEntryOpen} onOpenChange={setTimeEntryOpen} />
    </>
  );
}
