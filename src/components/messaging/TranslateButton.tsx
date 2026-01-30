import { Globe, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TranslateButtonProps {
  onClick: () => void;
  isTranslating?: boolean;
  isTranslated?: boolean;
  onClearTranslation?: () => void;
  className?: string;
  size?: "sm" | "default";
}

export function TranslateButton({
  onClick,
  isTranslating = false,
  isTranslated = false,
  onClearTranslation,
  className,
  size = "sm",
}: TranslateButtonProps) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-6 w-6" : "h-8 w-8";

  if (isTranslated && onClearTranslation) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                buttonSize,
                "text-primary hover:text-primary/80",
                className
              )}
              onClick={onClearTranslation}
              disabled={isTranslating}
            >
              <X className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p className="text-xs">Show original</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              buttonSize,
              "text-muted-foreground hover:text-foreground",
              className
            )}
            onClick={onClick}
            disabled={isTranslating}
          >
            {isTranslating ? (
              <Loader2 className={cn(iconSize, "animate-spin")} />
            ) : (
              <Globe className={iconSize} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">Translate message</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
