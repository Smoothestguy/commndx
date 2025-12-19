import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormattedPhoneInputProps {
  label?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  helpText?: string;
  showIcon?: boolean;
  className?: string;
}

export function FormattedPhoneInput({
  label = "Phone Number",
  required,
  value = "",
  onChange,
  disabled,
  helpText,
  showIcon = true,
  className,
}: FormattedPhoneInputProps) {
  const part1Ref = useRef<HTMLInputElement>(null);
  const part2Ref = useRef<HTMLInputElement>(null);
  const part3Ref = useRef<HTMLInputElement>(null);

  // Parse value into 3 parts
  const digits = value.replace(/\D/g, "");
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 10);

  const handlePartChange = (
    partIndex: 1 | 2 | 3,
    newValue: string,
    maxLength: number
  ) => {
    const onlyDigits = newValue.replace(/\D/g, "").slice(0, maxLength);
    
    let newFull = "";
    if (partIndex === 1) {
      newFull = onlyDigits + part2 + part3;
    } else if (partIndex === 2) {
      newFull = part1 + onlyDigits + part3;
    } else {
      newFull = part1 + part2 + onlyDigits;
    }
    
    onChange?.(newFull);

    // Auto-advance to next field when full
    if (onlyDigits.length === maxLength) {
      if (partIndex === 1) part2Ref.current?.focus();
      if (partIndex === 2) part3Ref.current?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    partIndex: 1 | 2 | 3,
    currentValue: string
  ) => {
    // Backspace at start of field moves to previous
    if (e.key === "Backspace" && currentValue === "") {
      e.preventDefault();
      if (partIndex === 2) {
        part1Ref.current?.focus();
      } else if (partIndex === 3) {
        part2Ref.current?.focus();
      }
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      <div className="flex items-center gap-2">
        {showIcon && (
          <div className="flex items-center justify-center w-10 h-10 bg-muted rounded-md border">
            <Phone className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        
        <div className="flex items-center gap-1 flex-1">
          <span className="text-muted-foreground">(</span>
          <Input
            ref={part1Ref}
            value={part1}
            onChange={(e) => handlePartChange(1, e.target.value, 3)}
            onKeyDown={(e) => handleKeyDown(e, 1, part1)}
            placeholder="555"
            className="w-14 text-center px-1"
            maxLength={3}
            disabled={disabled}
          />
          <span className="text-muted-foreground">)</span>
          <Input
            ref={part2Ref}
            value={part2}
            onChange={(e) => handlePartChange(2, e.target.value, 3)}
            onKeyDown={(e) => handleKeyDown(e, 2, part2)}
            placeholder="123"
            className="w-14 text-center px-1"
            maxLength={3}
            disabled={disabled}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            ref={part3Ref}
            value={part3}
            onChange={(e) => handlePartChange(3, e.target.value, 4)}
            onKeyDown={(e) => handleKeyDown(e, 3, part3)}
            placeholder="4567"
            className="w-16 text-center px-1"
            maxLength={4}
            disabled={disabled}
          />
        </div>
      </div>
      
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
