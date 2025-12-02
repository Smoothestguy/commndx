import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface SSNInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export const SSNInput = ({ value, onChange, required }: SSNInputProps) => {
  const [showFull, setShowFull] = useState(false);

  const formatSSN = (input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, "").slice(0, 9);
    return digits;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSSN(e.target.value);
    onChange(formatted);
  };

  const getDisplayValue = () => {
    if (!value) return "";
    
    if (showFull) {
      // Show full formatted SSN: XXX-XX-XXXX
      if (value.length <= 3) return value;
      if (value.length <= 5) return `${value.slice(0, 3)}-${value.slice(3)}`;
      return `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`;
    } else {
      // Show masked: •••-••-XXXX
      if (value.length <= 5) return "•".repeat(value.length);
      const lastFour = value.slice(5);
      return `•••-••-${lastFour || "••••".slice(0, 4 - lastFour.length)}`;
    }
  };

  return (
    <div className="relative">
      <Input
        type={showFull ? "text" : "text"}
        value={showFull ? value : ""}
        onChange={handleChange}
        placeholder="Enter 9-digit SSN"
        maxLength={11}
        required={required}
        className="pr-10 font-mono"
      />
      {value && !showFull && (
        <div className="absolute inset-0 flex items-center px-3 pointer-events-none font-mono text-foreground">
          {getDisplayValue()}
        </div>
      )}
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
  );
};