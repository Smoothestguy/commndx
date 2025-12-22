import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignaturePad } from "@/components/form-builder/SignaturePad";
import { Info } from "lucide-react";

interface DirectDepositFormProps {
  data: {
    bank_name: string;
    bank_account_type: string;
    bank_routing_number: string;
    bank_account_number: string;
    direct_deposit_signature: string | null;
  };
  onChange: (field: string, value: string | null) => void;
  personnelName: string;
}

export function DirectDepositForm({ data, onChange, personnelName }: DirectDepositFormProps) {
  const validateRoutingNumber = (value: string) => {
    // Routing numbers are exactly 9 digits
    return /^\d{0,9}$/.test(value);
  };

  const validateAccountNumber = (value: string) => {
    // Account numbers are typically 4-17 digits
    return /^\d{0,17}$/.test(value);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Your banking information will be securely stored and used for direct deposit of your payments.
        </AlertDescription>
      </Alert>

      {/* Bank Information */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Bank Information
        </h3>

        <div className="space-y-2">
          <Label htmlFor="bank_name">Bank Name *</Label>
          <Input
            id="bank_name"
            value={data.bank_name}
            onChange={(e) => onChange("bank_name", e.target.value)}
            placeholder="e.g., Chase Bank, Wells Fargo"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Account Type *</Label>
          <RadioGroup
            value={data.bank_account_type}
            onValueChange={(value) => onChange("bank_account_type", value)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="checking" id="checking" />
              <Label htmlFor="checking" className="cursor-pointer">Checking</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="savings" id="savings" />
              <Label htmlFor="savings" className="cursor-pointer">Savings</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bank_routing_number">Routing Number *</Label>
            <Input
              id="bank_routing_number"
              value={data.bank_routing_number}
              onChange={(e) => {
                if (validateRoutingNumber(e.target.value)) {
                  onChange("bank_routing_number", e.target.value);
                }
              }}
              placeholder="9 digits"
              maxLength={9}
              required
            />
            <p className="text-xs text-muted-foreground">
              9-digit number found on your check
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank_account_number">Account Number *</Label>
            <Input
              id="bank_account_number"
              value={data.bank_account_number}
              onChange={(e) => {
                if (validateAccountNumber(e.target.value)) {
                  onChange("bank_account_number", e.target.value);
                }
              }}
              placeholder="Account number"
              maxLength={17}
              required
            />
          </div>
        </div>
      </div>

      {/* Authorization Section */}
      <div className="border-t pt-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Authorization
        </h3>
        
        <div className="p-4 bg-muted/50 rounded-lg text-sm space-y-2">
          <p>
            I, <strong>{personnelName}</strong>, authorize Fairfield Response Group LLC to deposit 
            payments directly into the bank account listed above. This authorization will remain 
            in effect until I provide written notification to cancel or change my direct deposit 
            information.
          </p>
          <p className="text-muted-foreground">
            I understand that I am responsible for verifying deposits and ensuring accuracy. 
            Fairfield Response Group LLC is not responsible for errors or delays caused by 
            incorrect or incomplete information provided by me.
          </p>
        </div>

        <SignaturePad
          value={data.direct_deposit_signature || undefined}
          onChange={(sig) => onChange("direct_deposit_signature", sig)}
          label="Signature *"
          required
          helpText="Sign above to authorize direct deposit"
        />
      </div>
    </div>
  );
}
