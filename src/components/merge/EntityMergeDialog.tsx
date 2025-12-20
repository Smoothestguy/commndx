import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, ArrowRight, Check, Loader2, Merge } from "lucide-react";
import { useEntityMerge, useMergePreview, EntityType } from "@/hooks/useEntityMerge";

interface EntityMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  sourceEntity: Record<string, any>;
  targetEntity: Record<string, any>;
  onMergeComplete?: () => void;
}

type FieldChoice = "source" | "target";

const MERGE_FIELDS: Record<EntityType, string[]> = {
  customer: ["name", "email", "phone", "company", "address", "jobsite_address", "tax_exempt", "customer_type", "notes"],
  vendor: ["name", "email", "phone", "company", "address", "city", "state", "zip", "vendor_type", "tax_id", "notes"],
  personnel: ["first_name", "last_name", "email", "phone", "address", "city", "state", "zip", "ssn_last_four", "date_of_birth", "citizenship_status", "immigration_status"],
};

const SENSITIVE_FIELDS = ["tax_id", "ssn_last_four", "ssn_full"];

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  address: "Address",
  jobsite_address: "Jobsite Address",
  tax_exempt: "Tax Exempt",
  customer_type: "Customer Type",
  notes: "Notes",
  city: "City",
  state: "State",
  zip: "ZIP Code",
  vendor_type: "Vendor Type",
  tax_id: "Tax ID / EIN",
  first_name: "First Name",
  last_name: "Last Name",
  ssn_last_four: "SSN (Last 4)",
  date_of_birth: "Date of Birth",
  citizenship_status: "Citizenship Status",
  immigration_status: "Immigration Status",
};

export function EntityMergeDialog({
  open,
  onOpenChange,
  entityType,
  sourceEntity,
  targetEntity,
  onMergeComplete,
}: EntityMergeDialogProps) {
  const [fieldResolutions, setFieldResolutions] = useState<Record<string, FieldChoice>>({});
  const [mergeReason, setMergeReason] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [sensitiveConfirmed, setSensitiveConfirmed] = useState(false);

  const mergeMutation = useEntityMerge();
  const { data: preview, isLoading: previewLoading } = useMergePreview(
    entityType,
    sourceEntity?.id,
    targetEntity?.id
  );

  const fields = MERGE_FIELDS[entityType];

  // Initialize field resolutions - default to target (surviving) values
  useEffect(() => {
    if (open && sourceEntity && targetEntity) {
      const initial: Record<string, FieldChoice> = {};
      fields.forEach((field) => {
        // Default to target unless target value is empty and source has value
        const targetValue = targetEntity[field];
        const sourceValue = sourceEntity[field];
        
        if (!targetValue && sourceValue) {
          initial[field] = "source";
        } else {
          initial[field] = "target";
        }
      });
      setFieldResolutions(initial);
      setConfirmStep(false);
      setSensitiveConfirmed(false);
      setMergeReason("");
    }
  }, [open, sourceEntity?.id, targetEntity?.id]);

  const handleFieldChange = (field: string, value: FieldChoice) => {
    setFieldResolutions((prev) => ({ ...prev, [field]: value }));
    
    // Reset sensitive confirmation if changing sensitive fields
    if (SENSITIVE_FIELDS.includes(field)) {
      setSensitiveConfirmed(false);
    }
  };

  const hasSensitiveFieldChanges = () => {
    return SENSITIVE_FIELDS.some(
      (field) => fieldResolutions[field] === "source" && sourceEntity[field] !== targetEntity[field]
    );
  };

  const handleMerge = async () => {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    try {
      await mergeMutation.mutateAsync({
        entityType,
        sourceId: sourceEntity.id,
        targetId: targetEntity.id,
        fieldResolutions,
        mergeReason: mergeReason || undefined,
      });
      
      onOpenChange(false);
      onMergeComplete?.();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const getDisplayValue = (entity: Record<string, any>, field: string): string => {
    const value = entity[field];
    if (value === null || value === undefined) return "(empty)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (field === "ssn_last_four" && value) return `****${value}`;
    if (field === "tax_id" && value) return value.replace(/^(.{4})/, "****");
    return String(value);
  };

  const getEntityDisplayName = (entity: Record<string, any>): string => {
    if (entityType === "personnel") {
      return `${entity.first_name || ""} ${entity.last_name || ""}`.trim() || "Unnamed";
    }
    return entity.name || "Unnamed";
  };

  const canProceed = !hasSensitiveFieldChanges() || sensitiveConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge {entityType.charAt(0).toUpperCase() + entityType.slice(1)} Records
          </DialogTitle>
          <DialogDescription>
            Choose which values to keep for each field. The source record will be merged into the target record.
          </DialogDescription>
        </DialogHeader>

        {!confirmStep ? (
          <ScrollArea className="flex-1 pr-4">
            {/* Entity Header */}
            <div className="grid grid-cols-3 gap-4 mb-6 sticky top-0 bg-background py-2 z-10">
              <div className="font-medium text-muted-foreground">Field</div>
              <div className="text-center">
                <Badge variant="outline" className="mb-1">Source (to be merged)</Badge>
                <div className="font-medium text-sm">{getEntityDisplayName(sourceEntity)}</div>
              </div>
              <div className="text-center">
                <Badge variant="default" className="mb-1">Target (surviving)</Badge>
                <div className="font-medium text-sm">{getEntityDisplayName(targetEntity)}</div>
              </div>
            </div>

            <Separator className="mb-4" />

            {/* Field Selection */}
            <div className="space-y-4">
              {fields.map((field) => {
                const sourceValue = getDisplayValue(sourceEntity, field);
                const targetValue = getDisplayValue(targetEntity, field);
                const isDifferent = sourceValue !== targetValue;
                const isSensitive = SENSITIVE_FIELDS.includes(field);

                return (
                  <div
                    key={field}
                    className={`grid grid-cols-3 gap-4 items-center py-2 px-3 rounded-lg ${
                      isDifferent ? "bg-muted/50" : ""
                    }`}
                  >
                    <Label className="flex items-center gap-2">
                      {FIELD_LABELS[field] || field}
                      {isSensitive && (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      )}
                    </Label>

                    <RadioGroup
                      value={fieldResolutions[field]}
                      onValueChange={(value) => handleFieldChange(field, value as FieldChoice)}
                      className="col-span-2 grid grid-cols-2 gap-2"
                    >
                      <label
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                          fieldResolutions[field] === "source"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <RadioGroupItem value="source" />
                        <span className="text-sm truncate">{sourceValue}</span>
                      </label>

                      <label
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                          fieldResolutions[field] === "target"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <RadioGroupItem value="target" />
                        <span className="text-sm truncate">{targetValue}</span>
                      </label>
                    </RadioGroup>
                  </div>
                );
              })}
            </div>

            <Separator className="my-4" />

            {/* Merge Reason */}
            <div className="space-y-2">
              <Label htmlFor="mergeReason">Merge Reason (optional)</Label>
              <Textarea
                id="mergeReason"
                placeholder="Explain why these records are being merged..."
                value={mergeReason}
                onChange={(e) => setMergeReason(e.target.value)}
                rows={2}
              />
            </div>

            {/* Sensitive Field Warning */}
            {hasSensitiveFieldChanges() && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Tax-sensitive field change detected</p>
                  <p className="text-sm mt-1">
                    You are changing Tax ID or SSN values. This may affect tax reporting.
                  </p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sensitiveConfirmed}
                      onChange={(e) => setSensitiveConfirmed(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">I confirm this change is intentional</span>
                  </label>
                </AlertDescription>
              </Alert>
            )}
          </ScrollArea>
        ) : (
          /* Confirmation Step */
          <div className="flex-1 space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Confirm Merge Action</p>
                <p className="text-sm mt-1">
                  This action cannot be undone through the UI. The source record will be marked as merged
                  and all historical data will be preserved.
                </p>
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4 p-4 border rounded-lg">
              <div className="text-center">
                <div className="font-medium">{getEntityDisplayName(sourceEntity)}</div>
                <div className="text-sm text-muted-foreground">will be merged into</div>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <div className="font-medium">{getEntityDisplayName(targetEntity)}</div>
                <div className="text-sm text-muted-foreground">surviving record</div>
              </div>
            </div>

            {/* Impact Preview */}
            {preview && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Records to be transferred:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {preview.invoices > 0 && (
                    <div>
                      <span className="text-muted-foreground">Invoices:</span>{" "}
                      <span className="font-medium">{preview.invoices}</span>
                      <span className="text-muted-foreground ml-1">
                        (${preview.invoiceTotal.toLocaleString()})
                      </span>
                    </div>
                  )}
                  {preview.bills > 0 && (
                    <div>
                      <span className="text-muted-foreground">Bills:</span>{" "}
                      <span className="font-medium">{preview.bills}</span>
                      <span className="text-muted-foreground ml-1">
                        (${preview.billTotal.toLocaleString()})
                      </span>
                    </div>
                  )}
                  {preview.projects > 0 && (
                    <div>
                      <span className="text-muted-foreground">Projects/POs:</span>{" "}
                      <span className="font-medium">{preview.projects}</span>
                    </div>
                  )}
                  {preview.timeEntries > 0 && (
                    <div>
                      <span className="text-muted-foreground">Time Entries:</span>{" "}
                      <span className="font-medium">{preview.timeEntries}</span>
                    </div>
                  )}
                  {preview.payments > 0 && (
                    <div>
                      <span className="text-muted-foreground">Payments:</span>{" "}
                      <span className="font-medium">{preview.payments}</span>
                      <span className="text-muted-foreground ml-1">
                        (${preview.paymentTotal.toLocaleString()})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mergeReason && (
              <div className="text-sm">
                <span className="text-muted-foreground">Reason: </span>
                {mergeReason}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          {confirmStep ? (
            <>
              <Button variant="outline" onClick={() => setConfirmStep(false)}>
                Back
              </Button>
              <Button
                onClick={handleMerge}
                disabled={mergeMutation.isPending}
                className="gap-2"
              >
                {mergeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Merging...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm Merge
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleMerge} disabled={!canProceed} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Review Merge
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
