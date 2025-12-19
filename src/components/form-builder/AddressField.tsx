import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export interface AddressValue {
  street: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

interface AddressFieldProps {
  label?: string;
  required?: boolean;
  value?: AddressValue;
  onChange?: (value: AddressValue) => void;
  disabled?: boolean;
  helpText?: string;
}

export function AddressField({ 
  label = "Mailing Address", 
  required, 
  value, 
  onChange, 
  disabled,
  helpText
}: AddressFieldProps) {
  const currentValue: AddressValue = value || { street: "", line2: "", city: "", state: "", zip: "" };
  
  const handleChange = (field: keyof AddressValue, fieldValue: string) => {
    if (onChange) {
      onChange({ ...currentValue, [field]: fieldValue });
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <div className="space-y-2">
        <Input
          placeholder="Street Address"
          value={currentValue.street}
          onChange={(e) => handleChange("street", e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="Address Line 2 (Optional)"
          value={currentValue.line2}
          onChange={(e) => handleChange("line2", e.target.value)}
          disabled={disabled}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="City"
            value={currentValue.city}
            onChange={(e) => handleChange("city", e.target.value)}
            disabled={disabled}
          />
          <Select
            value={currentValue.state}
            onValueChange={(v) => handleChange("state", v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="ZIP Code"
          value={currentValue.zip}
          onChange={(e) => handleChange("zip", e.target.value)}
          disabled={disabled}
          className="w-1/3 min-w-[120px]"
        />
      </div>
      
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
