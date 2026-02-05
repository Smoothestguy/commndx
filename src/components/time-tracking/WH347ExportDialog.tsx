import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileCheck, AlertCircle, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/integrations/supabase/hooks/useCompanySettings";
import {
  organizeEntriesForWH347,
  type WH347ExportData,
} from "@/utils/wh347ExportUtils";

// Common work classifications for Davis-Bacon projects
const WORK_CLASSIFICATIONS = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "Laborer",
  "Ironworker",
  "Equipment Operator",
  "Pipefitter",
  "Sheet Metal Worker",
  "Painter",
  "Roofer",
  "Mason",
  "Welder",
  "HVAC Technician",
  "Insulation Worker",
  "Glazier",
  "Foreman",
  "Superintendent",
  "Other",
];

interface TimeEntryWithRelations {
  id: string;
  entry_date: string;
  hours: number;
  regular_hours?: number | null;
  overtime_hours?: number | null;
  hourly_rate?: number | null;
  project_id: string;
  personnel_id?: string | null;
  personnel?: {
    id: string;
    first_name: string;
    last_name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    ssn_last_four?: string | null;
    hourly_rate?: number | null;
  } | null;
  projects?: {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    customer_po?: string | null;
  } | null;
}

interface PersonnelClassification {
  personnelId: string;
  personnelName: string;
  classification: string;
  withholdingExemptions: number;
  selected: boolean;
}

interface WH347ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: TimeEntryWithRelations[];
  weekStart: Date;
  projectId?: string;
  projectName?: string;
}

export function WH347ExportDialog({
  open,
  onOpenChange,
  entries,
  weekStart,
  projectId,
  projectName,
}: WH347ExportDialogProps) {
  const [payrollNumber, setPayrollNumber] = useState("");
  const [certifierName, setCertifierName] = useState("");
  const [certifierTitle, setCertifierTitle] = useState("");
  const [isSubcontractor, setIsSubcontractor] = useState(false);
  const [fringePaidToPlan, setFringePaidToPlan] = useState(false);
  const [fringePaidInCash, setFringePaidInCash] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [personnelClassifications, setPersonnelClassifications] = useState<
    PersonnelClassification[]
  >([]);

  const { data: companySettings } = useCompanySettings();
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 }); // Sunday end

  // Get unique personnel from entries
  const uniquePersonnel = useMemo(() => {
    const personnelMap = new Map<
      string,
      { id: string; name: string; hasClassification: boolean }
    >();

    entries.forEach((entry) => {
      if (entry.personnel_id && entry.personnel) {
        personnelMap.set(entry.personnel_id, {
          id: entry.personnel_id,
          name: `${entry.personnel.first_name} ${entry.personnel.last_name}`,
          hasClassification: false, // Will be updated when we fetch assignments
        });
      }
    });

    return Array.from(personnelMap.values());
  }, [entries]);

  // Initialize personnel classifications when dialog opens
  useEffect(() => {
    if (open && uniquePersonnel.length > 0 && personnelClassifications.length === 0) {
      // Fetch existing classifications from assignments
      const fetchClassifications = async () => {
        if (!projectId) return;

        const { data: assignments } = await supabase
          .from("personnel_project_assignments")
          .select("personnel_id, work_classification")
          .eq("project_id", projectId)
          .in(
            "personnel_id",
            uniquePersonnel.map((p) => p.id)
          );

        const classificationMap = new Map(
          (assignments || []).map((a) => [a.personnel_id, a.work_classification])
        );

        setPersonnelClassifications(
          uniquePersonnel.map((p) => ({
            personnelId: p.id,
            personnelName: p.name,
            classification: classificationMap.get(p.id) || "",
            withholdingExemptions: 0,
            selected: true,
          }))
        );
      };

      fetchClassifications();
    }
  }, [open, uniquePersonnel, projectId, personnelClassifications.length]);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPayrollNumber("");
      setCertifierName("");
      setCertifierTitle("");
      setIsSubcontractor(false);
      setFringePaidToPlan(false);
      setFringePaidInCash(false);
      setPersonnelClassifications([]);
    }
    onOpenChange(newOpen);
  };

  const handleClassificationChange = (personnelId: string, classification: string) => {
    setPersonnelClassifications((prev) =>
      prev.map((p) =>
        p.personnelId === personnelId ? { ...p, classification } : p
      )
    );
  };

  const handleWithholdingChange = (personnelId: string, exemptions: number) => {
    setPersonnelClassifications((prev) =>
      prev.map((p) =>
        p.personnelId === personnelId ? { ...p, withholdingExemptions: exemptions } : p
      )
    );
  };

  const handleSelectionChange = (personnelId: string, selected: boolean) => {
    setPersonnelClassifications((prev) =>
      prev.map((p) =>
        p.personnelId === personnelId ? { ...p, selected } : p
      )
    );
  };

  const selectedPersonnel = personnelClassifications.filter((p) => p.selected);
  const missingClassifications = selectedPersonnel.filter((p) => !p.classification);

  const handleGenerate = async () => {
    if (!payrollNumber.trim()) {
      toast.error("Please enter a payroll number");
      return;
    }

    if (missingClassifications.length > 0) {
      toast.error("Please assign work classifications to all selected personnel");
      return;
    }

    if (selectedPersonnel.length === 0) {
      toast.error("Please select at least one personnel to include");
      return;
    }

    setIsGenerating(true);

    try {
      // Update work classifications in database
      for (const pc of personnelClassifications) {
        if (pc.classification) {
          await supabase
            .from("personnel_project_assignments")
            .update({ work_classification: pc.classification })
            .eq("project_id", projectId)
            .eq("personnel_id", pc.personnelId);
        }
      }

      // Filter entries to only selected personnel
      const selectedPersonnelIds = new Set(selectedPersonnel.map((p) => p.personnelId));
      const filteredEntries = entries.filter(
        (e) => e.personnel_id && selectedPersonnelIds.has(e.personnel_id)
      );

      // Get project info
      const project = entries[0]?.projects;
      const projectLocation = project
        ? [project.address, project.city, project.state].filter(Boolean).join(", ")
        : "";

      // Build assignments array for organizing entries
      const assignments = personnelClassifications.map((pc) => ({
        personnel_id: pc.personnelId,
        work_classification: pc.classification,
        withholding_exemptions: pc.withholdingExemptions,
      }));

      // Organize entries
      const employeeRows = organizeEntriesForWH347(
        filteredEntries,
        weekEnd,
        assignments,
        companySettings?.overtime_multiplier || 1.5,
        companySettings?.weekly_overtime_threshold || 40
      );

      // Build contractor address
      const contractorAddress = companySettings
        ? [
            companySettings.address,
            companySettings.city,
            companySettings.state,
            companySettings.zip,
          ]
            .filter(Boolean)
            .join(", ")
        : "";

      // Transform employee data for edge function
      const formDataForBackend = {
        contractorName: companySettings?.company_name || "Company Name",
        contractorAddress,
        isSubcontractor,
        payrollNumber: payrollNumber.trim(),
        weekEnding: format(weekEnd, "MM/dd/yyyy"),
        projectName: projectName || project?.name || "Project",
        projectLocation,
        contractNumber: project?.customer_po || "",
        employees: employeeRows.map((emp) => ({
          name: `${emp.personnel.lastName}, ${emp.personnel.firstName}`,
          address: [emp.personnel.address, emp.personnel.city, emp.personnel.state, emp.personnel.zip]
            .filter(Boolean)
            .join(", "),
          ssnLastFour: emp.personnel.ssnLastFour || "",
          withholdingExemptions: emp.personnel.withholdingExemptions || 0,
          workClassification: emp.personnel.workClassification || "",
          dailyHours: emp.dailyHours.map((d) => ({
            straight: d.straightHours,
            overtime: d.overtimeHours,
          })),
          totalHours: {
            straight: emp.regularHours,
            overtime: emp.overtimeHours,
          },
          rateOfPay: {
            straight: emp.straightRate,
            overtime: emp.overtimeRate,
          },
          grossEarned: emp.grossEarned,
          deductions: emp.deductions,
          totalDeductions: emp.deductions.fica + emp.deductions.withholding + emp.deductions.other,
          netWages: emp.netWages,
        })),
        signatory: {
          name: certifierName.trim() || "",
          title: certifierTitle.trim() || "",
          date: format(new Date(), "MM/dd/yyyy"),
        },
        fringeBenefits: {
          paidToPlans: fringePaidToPlan,
          paidInCash: fringePaidInCash,
        },
      };

      // Call dedicated WH-347 edge function to generate PDF using official template
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
        "generate-wh347",
        {
          body: { formData: formDataForBackend },
        }
      );

      if (pdfError) {
        throw new Error(pdfError.message || "Failed to generate PDF");
      }

      // Download the generated PDF
      const blob = new Blob([pdfData], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `WH-347_${(projectName || "Project").replace(/[^a-zA-Z0-9]/g, "_")}_${format(weekEnd, "yyyy-MM-dd")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("WH-347 form generated successfully");
      handleOpenChange(false);
    } catch (error) {
      console.error("Error generating WH-347:", error);
      toast.error("Failed to generate WH-347 form");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Export WH-347 Certified Payroll
          </DialogTitle>
          <DialogDescription>
            Generate the official U.S. Department of Labor WH-347 form for{" "}
            <span className="font-medium">{projectName}</span> •{" "}
            Week ending {format(weekEnd, "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* Contractor/Subcontractor Toggle */}
            <div className="space-y-3">
              <Label>Type</Label>
              <RadioGroup
                value={isSubcontractor ? "subcontractor" : "contractor"}
                onValueChange={(value) => setIsSubcontractor(value === "subcontractor")}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contractor" id="contractor" />
                  <Label htmlFor="contractor" className="font-normal cursor-pointer">
                    Contractor
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="subcontractor" id="subcontractor" />
                  <Label htmlFor="subcontractor" className="font-normal cursor-pointer">
                    Subcontractor
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Payroll Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Payroll Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payroll-number">Payroll Number *</Label>
                  <Input
                    id="payroll-number"
                    placeholder="e.g., 1, 2, 3..."
                    value={payrollNumber}
                    onChange={(e) => setPayrollNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sequential number for this project
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Week Period</Label>
                  <div className="p-2 bg-muted rounded-md text-sm">
                    {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                  </div>
                </div>
              </div>
            </div>

            {/* Personnel Selection & Classification */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Personnel & Work Classifications</h3>
                <Badge variant="outline">
                  {selectedPersonnel.length} of {personnelClassifications.length} selected
                </Badge>
              </div>

              {missingClassifications.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                  <div className="text-sm text-warning-foreground">
                    <span className="font-medium">{missingClassifications.length} personnel</span>{" "}
                    missing work classification
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {personnelClassifications.map((pc) => (
                  <div
                    key={pc.personnelId}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <Checkbox
                      id={`select-${pc.personnelId}`}
                      checked={pc.selected}
                      onCheckedChange={(checked) =>
                        handleSelectionChange(pc.personnelId, !!checked)
                      }
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{pc.personnelName}</span>
                    </div>
                    <Select
                      value={pc.classification}
                      onValueChange={(value) =>
                        handleClassificationChange(pc.personnelId, value)
                      }
                      disabled={!pc.selected}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Classification" />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_CLASSIFICATIONS.map((classification) => (
                          <SelectItem key={classification} value={classification}>
                            {classification}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Label htmlFor={`wh-${pc.personnelId}`} className="text-xs text-muted-foreground whitespace-nowrap">
                        W/H:
                      </Label>
                      <Input
                        id={`wh-${pc.personnelId}`}
                        type="number"
                        min="0"
                        max="10"
                        className="w-14 h-8 text-center"
                        value={pc.withholdingExemptions}
                        onChange={(e) =>
                          handleWithholdingChange(pc.personnelId, parseInt(e.target.value) || 0)
                        }
                        disabled={!pc.selected}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fringe Benefits */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Fringe Benefits (Statement of Compliance)</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="fringe-plan"
                    checked={fringePaidToPlan}
                    onCheckedChange={(checked) => setFringePaidToPlan(!!checked)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="fringe-plan" className="cursor-pointer">
                      (a) Fringe benefits paid to approved plans/funds
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Payments made to appropriate programs for employee benefit
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="fringe-cash"
                    checked={fringePaidInCash}
                    onCheckedChange={(checked) => setFringePaidInCash(!!checked)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="fringe-cash" className="cursor-pointer">
                      (b) Fringe benefits paid in cash
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Included in the hourly wage rate shown
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Certification Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Certification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="certifier-name">Name of Signatory</Label>
                  <Input
                    id="certifier-name"
                    placeholder="Full name"
                    value={certifierName}
                    onChange={(e) => setCertifierName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="certifier-title">Title</Label>
                  <Input
                    id="certifier-title"
                    placeholder="e.g., Payroll Manager"
                    value={certifierTitle}
                    onChange={(e) => setCertifierTitle(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || missingClassifications.length > 0 || selectedPersonnel.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileCheck className="h-4 w-4 mr-2" />
                Generate WH-347
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
