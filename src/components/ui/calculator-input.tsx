import * as React from "react";
import { cn } from "@/lib/utils";
import { Calculator } from "lucide-react";
import { evaluateExpression, isExpression } from "@/utils/expressionEvaluator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CalculatorInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string;
  onValueChange: (value: number) => void;
  decimalPlaces?: number;
  showCalculatorIcon?: boolean;
  allowNegative?: boolean;
}

const CalculatorInput = React.forwardRef<HTMLInputElement, CalculatorInputProps>(
  ({ className, value, onValueChange, decimalPlaces = 2, showCalculatorIcon = true, allowNegative = false, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(() => {
      const num = typeof value === 'number' ? value : parseFloat(value as string);
      return isNaN(num) || num === 0 ? '' : num.toString();
    });
    const [error, setError] = React.useState<string | null>(null);
    const [isEvaluating, setIsEvaluating] = React.useState(false);

    // Sync external value changes
    React.useEffect(() => {
      if (!isEvaluating) {
        const num = typeof value === 'number' ? value : parseFloat(value as string);
        const currentNum = parseFloat(displayValue);
        // Only update if the values are different
        if (!isNaN(num) && num !== currentNum) {
          setDisplayValue(num === 0 ? '' : num.toString());
        }
      }
    }, [value, isEvaluating]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setDisplayValue(newValue);
      setError(null);

      // If it's just a number (not an expression), update immediately
      if (!isExpression(newValue)) {
        const num = parseFloat(newValue);
        if (!isNaN(num)) {
          // Only allow negative values if allowNegative is true
          const finalValue = (!allowNegative && num < 0) ? Math.abs(num) : num;
          onValueChange(finalValue);
        } else if (newValue === '' || newValue === '-') {
          // Allow typing empty or starting a negative number
        }
      }
    };

    const evaluateAndFormat = () => {
      const trimmed = displayValue.trim();
      
      if (!trimmed) {
        setDisplayValue('');
        onValueChange(0);
        return;
      }

      // Check if it's an expression that needs evaluation
      if (isExpression(trimmed)) {
        setIsEvaluating(true);
        const result = evaluateExpression(trimmed);
        
        if (result.success && result.result !== undefined) {
          // Only allow negative values if allowNegative is true
          const finalValue = (!allowNegative && result.result < 0) ? Math.abs(result.result) : result.result;
          const formatted = finalValue.toFixed(decimalPlaces);
          setDisplayValue(formatted);
          onValueChange(parseFloat(formatted));
          setError(null);
        } else {
          setError(result.error || 'Invalid expression');
        }
        setIsEvaluating(false);
      } else {
        // Just a plain number - format it
        const num = parseFloat(trimmed);
        if (!isNaN(num)) {
          // Only allow negative values if allowNegative is true
          const finalValue = (!allowNegative && num < 0) ? Math.abs(num) : num;
          const formatted = finalValue.toFixed(decimalPlaces);
          setDisplayValue(formatted);
          onValueChange(parseFloat(formatted));
          setError(null);
        } else {
          setError('Invalid number');
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Prevent form submission
        evaluateAndFormat();
      }
    };

    const handleBlur = () => {
      evaluateAndFormat();
    };

    const inputElement = (
      <div className="relative">
        <input
          type="text"
          className={cn(
            "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            error ? "border-destructive focus-visible:ring-destructive" : "border-input",
            showCalculatorIcon && "pr-8",
            className
          )}
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          {...props}
        />
        {showCalculatorIcon && (
          <Calculator className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
      </div>
    );

    if (error) {
      return (
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger asChild>
              {inputElement}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-destructive text-destructive-foreground">
              <p>{error}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return inputElement;
  }
);

CalculatorInput.displayName = "CalculatorInput";

export { CalculatorInput };
