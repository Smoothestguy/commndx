import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTimeToDecimal, getConversionPreview } from "@/utils/timeToDecimal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TimeDecimalInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** Current decimal hours value */
  value: number;
  /** Callback when value changes (returns decimal hours) */
  onValueChange: (decimalHours: number) => void;
  /** Show conversion preview below input */
  showPreview?: boolean;
  /** Show clock icon */
  showIcon?: boolean;
  /** Compact mode for grid cells */
  compact?: boolean;
}

/**
 * Time-to-Decimal Input Component
 * 
 * Accepts flexible time formats and converts to decimal hours:
 * - "8:20" → 8.33 hours
 * - "820" → 8.33 hours  
 * - "8" → 8.00 hours
 * - "8.5" → 8.50 hours (already decimal)
 */
const TimeDecimalInput = React.forwardRef<HTMLInputElement, TimeDecimalInputProps>(
  (
    { className, value, onValueChange, showPreview = false, showIcon = false, compact = false, placeholder, ...props },
    ref
  ) => {
    const [displayValue, setDisplayValue] = React.useState<string>("");
    const [error, setError] = React.useState<string | null>(null);
    const [preview, setPreview] = React.useState<string | null>(null);
    const [isFocused, setIsFocused] = React.useState(false);

    const inputRef = React.useRef<HTMLInputElement | null>(null);

    // NOTE: react-hook-form can pass a new ref callback on each render.
    // If we put `ref` in the deps of a merged-ref callback, the callback identity changes,
    // which can cause Radix composed refs to attach/detach repeatedly and trigger nested updates.
    const forwardedRef = React.useRef<typeof ref>(ref);
    React.useEffect(() => {
      forwardedRef.current = ref;
    }, [ref]);

    const setMergedRef = React.useCallback((node: HTMLInputElement | null) => {
      inputRef.current = node;
      const currentRef = forwardedRef.current;
      if (!currentRef) return;
      if (typeof currentRef === "function") {
        currentRef(node);
      } else {
        (currentRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    }, []);

    // Sync display value when external value changes (only when not focused)
    React.useEffect(() => {
      if (value !== undefined && value !== null && !isFocused) {
        setDisplayValue(value > 0 ? value.toFixed(2) : "");
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setDisplayValue(newValue);
      setError(null);

      // Update preview for user feedback
      const previewText = getConversionPreview(newValue);
      setPreview(previewText);

      // Live commit: update parent state immediately if valid, but don't reformat display
      // This enables submit button as soon as valid value is typed
      if (!newValue || newValue.trim() === "") {
        onValueChange(0);
        return;
      }

      const result = parseTimeToDecimal(newValue);
      if (result.isValid) {
        onValueChange(result.decimalHours);
        // Don't setDisplayValue here - keep raw text while typing
      }
      // If invalid, keep previous numeric value in parent state (don't update)
    };

    const evaluateAndCommit = () => {
      if (!displayValue || displayValue.trim() === "") {
        onValueChange(0);
        setDisplayValue("");
        setError(null);
        setPreview(null);
        return;
      }

      const result = parseTimeToDecimal(displayValue);

      if (!result.isValid) {
        setError(result.error || "Invalid time format");
        return;
      }

      setError(null);
      setPreview(null);
      onValueChange(result.decimalHours);
      setDisplayValue(result.decimalHours > 0 ? result.decimalHours.toFixed(2) : "");
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
      evaluateAndCommit();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        evaluateAndCommit();
      }
    };

    const inputElement = (
      <div className="relative">
        {showIcon && (
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <input
          type="text"
          inputMode="decimal"
          ref={setMergedRef}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (compact ? "0" : "8:20 or 8.33")}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-colors",
            showIcon && "pl-9",
            error && "border-destructive focus-visible:ring-destructive",
            compact && "text-center",
            className
          )}
          {...props}
        />
      </div>
    );

    // Wrap with tooltip if there's an error
    if (error) {
      return (
        <div className="space-y-1">
          <TooltipProvider>
            <Tooltip open={true}>
              <TooltipTrigger asChild>
                {inputElement}
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-destructive text-destructive-foreground">
                <p className="text-xs">{error}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {showPreview && preview && (
            <p className="text-xs text-muted-foreground">{preview}</p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {inputElement}
        {showPreview && preview && (
          <p className="text-xs text-primary font-medium">{preview}</p>
        )}
      </div>
    );
  }
);

TimeDecimalInput.displayName = "TimeDecimalInput";

export { TimeDecimalInput };
