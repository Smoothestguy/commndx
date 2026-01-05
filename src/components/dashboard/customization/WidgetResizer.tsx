import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Maximize2, ArrowRight, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetSize } from "../widgets/types";

interface WidgetResizerProps {
  currentSize: WidgetSize;
  minSize?: WidgetSize;
  maxSize?: WidgetSize;
  onChange: (size: WidgetSize) => void;
}

export function WidgetResizer({
  currentSize,
  minSize = { width: 1, height: 1 },
  maxSize = { width: 4, height: 3 },
  onChange,
}: WidgetResizerProps) {
  const widthOptions = Array.from(
    { length: maxSize.width - minSize.width + 1 },
    (_, i) => minSize.width + i
  );
  const heightOptions = Array.from(
    { length: maxSize.height - minSize.height + 1 },
    (_, i) => minSize.height + i
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 bg-background/80 shadow-sm hover:bg-primary hover:text-primary-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-4">
          <div className="text-sm font-medium">Widget Size</div>
          
          {/* Width selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowRight className="h-3 w-3" />
              <span>Width (columns)</span>
            </div>
            <div className="flex gap-1">
              {widthOptions.map((w) => (
                <Button
                  key={`w-${w}`}
                  variant={currentSize.width === w ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex-1 h-8",
                    currentSize.width === w && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => onChange({ ...currentSize, width: w })}
                >
                  {w}
                </Button>
              ))}
            </div>
          </div>

          {/* Height selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowDown className="h-3 w-3" />
              <span>Height (rows)</span>
            </div>
            <div className="flex gap-1">
              {heightOptions.map((h) => (
                <Button
                  key={`h-${h}`}
                  variant={currentSize.height === h ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex-1 h-8",
                    currentSize.height === h && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => onChange({ ...currentSize, height: h })}
                >
                  {h}
                </Button>
              ))}
            </div>
          </div>

          {/* Size preview */}
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground text-center">
              Current: {currentSize.width} × {currentSize.height}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

