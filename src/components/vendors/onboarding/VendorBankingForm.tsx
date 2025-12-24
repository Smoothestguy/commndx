import { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Check } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";

interface VendorBankingFormProps {
  formData: {
    bank_name: string;
    bank_account_type: string;
    bank_routing_number: string;
    bank_account_number: string;
  };
  onUpdate: (field: string, value: string) => void;
}

export function VendorBankingForm({ formData, onUpdate }: VendorBankingFormProps) {
  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium">Banking Information</p>
              <p className="text-xs text-muted-foreground">
                Provide your banking details for payment processing. This information is stored
                securely and used only for payment purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="bank_name">Bank Name *</Label>
        <Input
          id="bank_name"
          value={formData.bank_name}
          onChange={(e) => onUpdate("bank_name", e.target.value)}
          placeholder="e.g., Chase Bank, Bank of America"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_account_type">Account Type *</Label>
        <Select
          value={formData.bank_account_type}
          onValueChange={(value) => onUpdate("bank_account_type", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checking">Checking</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_routing_number">Routing Number *</Label>
        <Input
          id="bank_routing_number"
          value={formData.bank_routing_number}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 9);
            onUpdate("bank_routing_number", value);
          }}
          placeholder="9-digit routing number"
          maxLength={9}
        />
        <p className="text-xs text-muted-foreground">
          The 9-digit routing number can be found at the bottom left of your check.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_account_number">Account Number *</Label>
        <Input
          id="bank_account_number"
          value={formData.bank_account_number}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 17);
            onUpdate("bank_account_number", value);
          }}
          placeholder="Account number"
          maxLength={17}
        />
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-sm">
        <p className="font-medium mb-2">🔒 Your information is secure</p>
        <p className="text-muted-foreground text-xs">
          Your banking information is encrypted and stored securely. We use industry-standard
          security measures to protect your data.
        </p>
      </div>
    </div>
  );
}
