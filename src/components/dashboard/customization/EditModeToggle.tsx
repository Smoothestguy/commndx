import { Button } from "@/components/ui/button";
import { Settings, Check, RotateCcw, Save, Undo2 } from "lucide-react";
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
  onSave?: () => void;
  onRevert?: () => void;
  onReset?: () => void;
  hasCustomConfig?: boolean;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
}

export function EditModeToggle({
  isEditMode,
  onToggle,
  onSave,
  onRevert,
  onReset,
  hasCustomConfig,
  hasUnsavedChanges,
  isSaving,
}: EditModeToggleProps) {
  if (isEditMode) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          onClick={onRevert}
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 px-2 sm:px-3"
          disabled={!hasUnsavedChanges || isSaving}
        >
          <Undo2 className="h-4 w-4" />
          <span className="hidden xs:inline">Revert</span>
        </Button>
        <Button
          onClick={onSave}
          variant="default"
          size="sm"
          className="gap-1.5 h-9 px-2 sm:px-3"
          disabled={!hasUnsavedChanges || isSaving}
        >
          <Save className="h-4 w-4" />
          <span className="hidden xs:inline">{isSaving ? "Saving..." : "Save"}</span>
        </Button>
        <Button
          onClick={onToggle}
          variant="ghost"
          size="sm"
          className="gap-1.5 h-9 px-2 sm:px-3"
        >
          <Check className="h-4 w-4" />
          <span className="hidden xs:inline">Done</span>
        </Button>
      </div>
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
