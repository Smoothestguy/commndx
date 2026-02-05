import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface ITINInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export const ITINInput = ({ value, onChange, required }: ITINInputProps) => {
  const [showFull, setShowFull] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const formatITIN = (input: string) => {
    // Remove all non-digits and limit to 9
    return input.replace(/\D/g, "").slice(0, 9);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatITIN(e.target.value);
    onChange(formatted);
  };

  const formatWithDashes = (digits: string) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  };

  const getMaskedValue = (digits: string) => {
    if (!digits) return "";
    if (digits.length <= 5) return "•".repeat(digits.length);
    const lastFour = digits.slice(5);
    const maskedLastFour = lastFour.padEnd(4, "•").slice(0, 4);
    return `•••-••-${maskedLastFour}`;
  };

  const getDisplayValue = () => {
    if (!value) return "";
    
    // When focused, show raw digits for easy typing
    if (isFocused) {
      return value;
    }
    
    // When blurred, show masked or full based on toggle
    if (showFull) {
      return formatWithDashes(value);
    }
    return getMaskedValue(value);
  };

  const isValidITIN = value.length === 0 || value.startsWith("9");

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          type="text"
          value={getDisplayValue()}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Enter 9-digit ITIN (starts with 9)"
          maxLength={11}
          required={required}
          className={`pr-10 font-mono ${!isValidITIN ? "border-destructive" : ""}`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setShowFull(!showFull)}
        >
          {showFull ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
      {!isValidITIN && (
        <p className="text-xs text-destructive">ITIN must start with 9</p>
      )}
    </div>
  );
};
