import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { User, Building2, Users, Loader2, CheckCircle } from "lucide-react";

export type RecordType = "personnel" | "vendor" | "customer" | "personnel_vendor";

interface ApprovalTypeSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (recordType: RecordType) => void;
  isLoading: boolean;
  applicantName: string;
}

const recordTypeOptions = [
  {
    value: "personnel" as RecordType,
    label: "Personnel (Worker/Contractor)",
    description: "Standard personnel record for staffing and time tracking",
    icon: User,
  },
  {
    value: "vendor" as RecordType,
    label: "Vendor (Subcontractor)",
    description: "Create as vendor for billing, purchase orders, and invoicing",
    icon: Building2,
  },
  {
    value: "customer" as RecordType,
    label: "Customer",
    description: "Create as customer record for projects and estimates",
    icon: Users,
  },
  {
    value: "personnel_vendor" as RecordType,
    label: "Personnel + Vendor",
    description: "Creates both records, linked together. Recommended for 1099 contractors",
    icon: User,
    recommended: true,
  },
];

export const ApprovalTypeSelectionDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  applicantName,
}: ApprovalTypeSelectionDialogProps) => {
  const [selectedType, setSelectedType] = useState<RecordType>("personnel");

  const handleConfirm = () => {
    onConfirm(selectedType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>How should this applicant be saved?</DialogTitle>
          <DialogDescription>
            Choose the record type for <strong>{applicantName}</strong>. This determines how they'll appear in the system.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedType}
          onValueChange={(value) => setSelectedType(value as RecordType)}
          className="space-y-3"
        >
          {recordTypeOptions.map((option) => (
            <div
              key={option.value}
              className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                selectedType === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => setSelectedType(option.value)}
            >
              <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <option.icon className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={option.value} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  {option.recommended && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Recommended for 1099
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Approve & Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
