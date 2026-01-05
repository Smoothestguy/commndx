import { Button } from "@/components/ui/button";
import { Settings, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EditModeToggleProps {
  isEditMode: boolean;
  onToggle: () => void;
  onReset?: () => void;
  hasCustomConfig?: boolean;
}

export function EditModeToggle({
  isEditMode,
  onToggle,
  onReset,
  hasCustomConfig,
}: EditModeToggleProps) {
  if (isEditMode) {
    return (
      <Button
        onClick={onToggle}
        variant="default"
        size="sm"
        className="gap-2"
      >
        <Check className="h-4 w-4" />
        Done Editing
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Customize
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onToggle}>
          <Settings className="h-4 w-4 mr-2" />
          Edit Dashboard
        </DropdownMenuItem>
        {hasCustomConfig && onReset && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReset} className="text-destructive">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
