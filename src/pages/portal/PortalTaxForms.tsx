import { useState, useEffect } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { useCurrentPersonnelW9Form, useSubmitW9Form, W9FormInput } from "@/integrations/supabase/hooks/useW9Forms";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, AlertCircle, Clock, XCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

export default function PortalTaxForms() {
  const { data: personnel, isLoading: personnelLoading } = useCurrentPersonnel();
  const { data: w9Form, isLoading: w9Loading } = useCurrentPersonnelW9Form(personnel?.id);
  const submitW9 = useSubmitW9Form();

  const [formData, setFormData] = useState({
    name_on_return: "",
    business_name: "",
    federal_tax_classification: "",
    llc_tax_classification: "",
    other_classification: "",
    has_foreign_partners: false,
    exempt_payee_code: "",
    fatca_exemption_code: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    account_numbers: "",
    tin_type: "ssn" as "ssn" | "ein",
    ein: "",
    certified_us_person: true,
    certified_correct_tin: true,
    certified_not_subject_backup_withholding: true,
    certified_fatca_exempt: false,
    signature_data: "",
  });

  const [isEditing, setIsEditing] = useState(false);

  // Check if Line 3b should be shown (Partnership, Trust/estate, or LLC with P classification)
  const showLine3b = 
    formData.federal_tax_classification === "partnership" ||
    formData.federal_tax_classification === "trust_estate" ||
    (formData.federal_tax_classification === "llc" && formData.llc_tax_classification?.toUpperCase() === "P");

  // Conditional field states based on tax classification
  const selectedClassification = formData.federal_tax_classification;

  // LLC dropdown visibility/enabled state
  const llcFieldState = {
    enabled: selectedClassification === "llc",
    required: selectedClassification === "llc"
  };

  // Other description field visibility/enabled state
  const otherFieldState = {
    enabled: selectedClassification === "other",
    required: selectedClassification === "other"
  };

  // TIN type requirements based on classification
  const tinRequirements = {
    einRequired: ["c_corporation", "s_corporation", "partnership"].includes(selectedClassification),
    ssnPreferred: selectedClassification === "individual",
    eitherAllowed: ["trust_estate", "llc", "other", ""].includes(selectedClassification)
  };

  // Handle classification change with dependent field clearing
  const handleClassificationChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      federal_tax_classification: value,
      // Clear LLC classification if not LLC
      llc_tax_classification: value === "llc" ? prev.llc_tax_classification : "",
      // Clear other classification if not Other
      other_classification: value === "other" ? prev.other_classification : "",
      // Clear business name if not LLC (only LLC allows both personal and business name)
      business_name: value === "llc" ? prev.business_name : "",
      // Reset foreign partners checkbox
      has_foreign_partners: false,
      // Auto-select TIN type for corporations/partnerships
      tin_type: ["c_corporation", "s_corporation", "partnership"].includes(value) ? "ein" : prev.tin_type
    }));
  };

  // Business name field state - only enabled for LLC
  const businessNameFieldState = {
    enabled: formData.federal_tax_classification === "llc",
    blocked: formData.federal_tax_classification !== "llc" && formData.federal_tax_classification !== ""
  };

  // Auto-select EIN for corporations/partnerships when classification changes
  useEffect(() => {
    if (["c_corporation", "s_corporation", "partnership"].includes(formData.federal_tax_classification)) {
      if (formData.tin_type !== "ein") {
        setFormData(prev => ({ ...prev, tin_type: "ein" }));
      }
    }
  }, [formData.federal_tax_classification]);

  // Pre-populate form when personnel data is loaded (for new W-9)
  useEffect(() => {
    if (personnel && !w9Form) {
      setFormData(prev => ({
        ...prev,
        name_on_return: `${personnel.first_name} ${personnel.last_name}`,
        address: personnel.address || "",
        city: personnel.city || "",
        state: personnel.state || "",
        zip: personnel.zip || "",
      }));
    }
  }, [personnel, w9Form]);

  // Pre-populate form when editing an existing W-9
  useEffect(() => {
    if (w9Form && isEditing) {
      setFormData({
        name_on_return: w9Form.name_on_return || "",
        business_name: w9Form.business_name || "",
        federal_tax_classification: w9Form.federal_tax_classification || "",
        llc_tax_classification: w9Form.llc_tax_classification || "",
        other_classification: w9Form.other_classification || "",
        has_foreign_partners: w9Form.has_foreign_partners ?? false,
        exempt_payee_code: w9Form.exempt_payee_code || "",
        fatca_exemption_code: w9Form.fatca_exemption_code || "",
        address: w9Form.address || "",
        city: w9Form.city || "",
        state: w9Form.state || "",
        zip: w9Form.zip || "",
        account_numbers: w9Form.account_numbers || "",
        tin_type: w9Form.tin_type || "ssn",
        ein: w9Form.ein || "",
        certified_us_person: w9Form.certified_us_person ?? true,
        certified_correct_tin: w9Form.certified_correct_tin ?? true,
        certified_not_subject_backup_withholding: w9Form.certified_not_subject_backup_withholding ?? true,
        certified_fatca_exempt: w9Form.certified_fatca_exempt ?? false,
        signature_data: "", // Clear signature to require re-signing
      });
    }
  }, [w9Form, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personnel?.id) return;

    const w9Data: W9FormInput = {
      personnel_id: personnel.id,
      name_on_return: formData.name_on_return,
      business_name: formData.business_name || null,
      federal_tax_classification: formData.federal_tax_classification,
      llc_tax_classification: formData.llc_tax_classification || null,
      other_classification: formData.other_classification || null,
      has_foreign_partners: showLine3b ? formData.has_foreign_partners : false,
      exempt_payee_code: formData.exempt_payee_code || null,
      fatca_exemption_code: formData.fatca_exemption_code || null,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
      account_numbers: formData.account_numbers || null,
      tin_type: formData.tin_type,
      ein: formData.tin_type === "ein" ? formData.ein : null,
      signature_data: formData.signature_data,
      signature_date: new Date().toISOString().split("T")[0],
      certified_us_person: formData.certified_us_person,
      certified_correct_tin: formData.certified_correct_tin,
      certified_not_subject_backup_withholding: formData.certified_not_subject_backup_withholding,
      certified_fatca_exempt: formData.certified_fatca_exempt,
    };

    await submitW9.mutateAsync(w9Data);
    setIsEditing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Submitted - Pending Review</Badge>;
      case "verified":
        return <Badge className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Submitted</Badge>;
    }
  };

  if (personnelLoading || w9Loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PortalLayout>
    );
  }

  // Show completed W-9 view
  if (w9Form && !isEditing) {
    // Check if Line 3b applies for the saved form
    const savedShowLine3b = 
      w9Form.federal_tax_classification === "partnership" ||
      w9Form.federal_tax_classification === "trust_estate" ||
      (w9Form.federal_tax_classification === "llc" && w9Form.llc_tax_classification?.toUpperCase() === "P");

    return (
      <PortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tax Forms</h1>
              <p className="text-muted-foreground">View and manage your tax documentation</p>
            </div>
            {getStatusBadge(w9Form.status)}
          </div>

          {w9Form.status === "rejected" && w9Form.rejection_reason && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>W-9 Rejected</AlertTitle>
              <AlertDescription>{w9Form.rejection_reason}</AlertDescription>
            </Alert>
          )}

          {/* IRS-Style Read-Only View */}
          <Card className="border-2 border-foreground/20 overflow-hidden">
            {/* Form Header */}
            <div className="border-b-2 border-foreground/20">
              <div className="flex">
                <div className="w-24 border-r-2 border-foreground/20 p-3 flex flex-col justify-center">
                  <span className="text-xs">Form</span>
                  <span className="text-2xl font-bold">W-9</span>
                  <span className="text-[10px] text-muted-foreground">(Rev. March 2024)</span>
                </div>
                <div className="flex-1 p-3">
                  <p className="text-xs text-muted-foreground">Department of the Treasury</p>
                  <p className="text-xs text-muted-foreground">Internal Revenue Service</p>
                  <p className="font-semibold mt-1">Request for Taxpayer Identification Number and Certification</p>
                </div>
              </div>
            </div>

            <CardContent className="p-0">
              {/* Line 1 - Name */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">1</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Name of entity/individual</p>
                    <p className="font-medium">{w9Form.name_on_return}</p>
                  </div>
                </div>
              </div>

              {/* Line 2 - Business Name */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">2</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Business name/disregarded entity name, if different from above</p>
                    <p className="font-medium">{w9Form.business_name || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Line 3a - Tax Classification */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">3a</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-2">Federal tax classification</p>
                    <p className="font-medium capitalize">{w9Form.federal_tax_classification.replace(/_/g, " ")}</p>
                    {w9Form.llc_tax_classification && (
                      <p className="text-sm text-muted-foreground mt-1">LLC Classification: {w9Form.llc_tax_classification}</p>
                    )}
                    {w9Form.other_classification && (
                      <p className="text-sm text-muted-foreground mt-1">Other: {w9Form.other_classification}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line 3b - Foreign Partners (conditional) */}
              {savedShowLine3b && (
                <div className="border-b border-foreground/20 p-3">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sm">3b</span>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Foreign partners, owners, or beneficiaries</p>
                      <p className="font-medium flex items-center gap-2">
                        {w9Form.has_foreign_partners ? (
                          <><CheckCircle className="h-4 w-4 text-amber-600" /> Yes - Has foreign partners/owners/beneficiaries</>
                        ) : (
                          <><XCircle className="h-4 w-4 text-muted-foreground" /> No</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Line 4 - Exemptions */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">4</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Exemptions (codes apply only to certain entities, not individuals)</p>
                    <div className="flex gap-6">
                      <div>
                        <span className="text-xs text-muted-foreground">Exempt payee code: </span>
                        <span className="font-medium">{w9Form.exempt_payee_code || "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">FATCA exemption code: </span>
                        <span className="font-medium">{w9Form.fatca_exemption_code || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line 5 - Address */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">5</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Address (number, street, and apt. or suite no.)</p>
                    <p className="font-medium">{w9Form.address}</p>
                  </div>
                </div>
              </div>

              {/* Line 6 - City, State, ZIP */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">6</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">City, state, and ZIP code</p>
                    <p className="font-medium">{w9Form.city}, {w9Form.state} {w9Form.zip}</p>
                  </div>
                </div>
              </div>

              {/* Line 7 - Account Numbers */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm">7</span>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">List account number(s) here (optional)</p>
                    <p className="font-medium">{w9Form.account_numbers || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Part I - TIN */}
              <div className="bg-slate-800 text-white px-3 py-2">
                <span className="font-bold">Part I</span>
                <span className="ml-4">Taxpayer Identification Number (TIN)</span>
              </div>
              <div className="border-b border-foreground/20 p-3">
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">TIN Type</p>
                    <p className="font-medium uppercase">{w9Form.tin_type}</p>
                  </div>
                  {w9Form.tin_type === "ssn" && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Social Security Number</p>
                      <p className="font-medium font-mono">XXX-XX-{personnel?.ssn_last_four || "XXXX"}</p>
                    </div>
                  )}
                  {w9Form.tin_type === "ein" && w9Form.ein && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Employer Identification Number</p>
                      <p className="font-medium font-mono">{w9Form.ein}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Part II - Certification */}
              <div className="bg-slate-800 text-white px-3 py-2">
                <span className="font-bold">Part II</span>
                <span className="ml-4">Certification</span>
              </div>
              <div className="border-b border-foreground/20 p-3">
                <p className="text-sm mb-2">Under penalties of perjury, I certify that:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>1. The number shown on this form is my correct taxpayer identification number</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>2. I am not subject to backup withholding</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>3. I am a U.S. citizen or other U.S. person</span>
                  </p>
                  <p className="flex items-start gap-2">
                    {w9Form.certified_fatca_exempt ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <span className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>4. FATCA code(s) indicating I am exempt from FATCA reporting is correct</span>
                  </p>
                </div>
              </div>

              {/* Signature */}
              <div className="p-3">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Signature of U.S. person</p>
                    {w9Form.signature_data?.startsWith("data:image") ? (
                      <img 
                        src={w9Form.signature_data} 
                        alt="Electronic Signature"
                        className="max-h-16 object-contain border-b border-foreground/40 pb-1"
                      />
                    ) : (
                      <p className="font-medium italic text-lg border-b border-foreground/40 pb-1">
                        {w9Form.signature_data || "—"}
                      </p>
                    )}
                  </div>
                  <div className="md:w-48">
                    <p className="text-xs text-muted-foreground mb-1">Date</p>
                    <p className="font-medium">{format(new Date(w9Form.signature_date), "MM/dd/yyyy")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            {(() => {
              // Determine if editing is allowed
              const canEdit = 
                w9Form.status === "rejected" || // Rejected - can always edit
                w9Form.status === "pending" || // Not yet submitted - can edit
                (w9Form.edit_allowed && 
                 (!w9Form.edit_allowed_until || new Date(w9Form.edit_allowed_until) > new Date()));
              
              if (canEdit) {
                return (
                  <>
                    <Button onClick={() => setIsEditing(true)} variant="outline">
                      Edit W-9 Form
                    </Button>
                    {w9Form.status === "verified" && (
                      <p className="text-sm text-muted-foreground">
                        Note: Editing will require re-verification by an administrator.
                      </p>
                    )}
                  </>
                );
              } else {
                return (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span className="text-sm">Editing locked. Contact administrator to request changes.</span>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      </PortalLayout>
    );
  }

  // Show W-9 form input - IRS Style (March 2024 Revision)
  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Tax Forms</h1>
          <p className="text-muted-foreground">Complete your tax documentation</p>
        </div>

        {!w9Form && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>W-9 Required</AlertTitle>
            <AlertDescription>
              Please complete your W-9 form below. This is required for tax reporting purposes.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-2 border-foreground/20 overflow-hidden">
          {/* IRS Form Header */}
          <div className="border-b-2 border-foreground/20">
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-28 border-b-2 sm:border-b-0 sm:border-r-2 border-foreground/20 p-3 flex flex-col justify-center items-center sm:items-start">
                <span className="text-xs text-muted-foreground">Form</span>
                <span className="text-3xl font-bold tracking-tight">W-9</span>
                <span className="text-[10px] text-muted-foreground">(Rev. March 2024)</span>
              </div>
              <div className="flex-1 p-3">
                <p className="text-xs text-muted-foreground">Department of the Treasury</p>
                <p className="text-xs text-muted-foreground">Internal Revenue Service</p>
                <p className="font-semibold text-lg mt-1">Request for Taxpayer Identification Number and Certification</p>
                <p className="text-xs text-muted-foreground mt-1">▶ Go to www.irs.gov/FormW9 for instructions and the latest information.</p>
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            <form onSubmit={handleSubmit}>
              {/* Before you begin instruction */}
              <div className="bg-muted/50 border-b border-foreground/20 p-3 text-sm">
                <span className="font-semibold">Before you begin.</span> For guidance related to the purpose of Form W-9, see Purpose of Form, below. <span className="font-semibold">Print or type.</span> See Specific Instructions on page 3.
              </div>

              {/* Line 1 - Name */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">1</span>
                  <div className="flex-1">
                    <Label htmlFor="name_on_return" className="text-xs text-muted-foreground">
                      {formData.federal_tax_classification === "llc" 
                        ? "Name of LLC member/owner. An entry is required."
                        : formData.federal_tax_classification === "individual"
                          ? "Your name (as shown on your income tax return). An entry is required."
                          : ["c_corporation", "s_corporation", "partnership", "trust_estate", "other"].includes(formData.federal_tax_classification)
                            ? "Name of entity. An entry is required."
                            : <>Name of entity/individual. An entry is required. <span className="text-[10px]">(For a sole proprietor or disregarded entity, enter the owner's name on line 1, and enter the business/disregarded entity's name on line 2.)</span></>
                      }
                    </Label>
                    <Input
                      id="name_on_return"
                      value={formData.name_on_return}
                      onChange={(e) => setFormData({ ...formData, name_on_return: e.target.value })}
                      className="mt-1 border-foreground/30 bg-muted/30"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Line 2 - Business Name (Only available for LLC) */}
              <div className={cn(
                "border-b border-foreground/20 p-3 transition-all duration-300 relative",
                businessNameFieldState.blocked && "opacity-50 bg-muted/30"
              )}>
                {/* Blocked overlay indicator */}
                {businessNameFieldState.blocked && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted">
                      N/A
                    </Badge>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">2</span>
                  <div className="flex-1">
                    <Label htmlFor="business_name" className={cn(
                      "text-xs transition-colors duration-300",
                      businessNameFieldState.blocked ? "text-muted-foreground" : "text-muted-foreground"
                    )}>
                      {formData.federal_tax_classification === "llc"
                        ? "Business name of LLC (required)"
                        : "Business name/disregarded entity name, if different from above"}
                    </Label>
                    <Input
                      id="business_name"
                      value={formData.business_name}
                      onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                      disabled={businessNameFieldState.blocked}
                      className={cn(
                        "mt-1 transition-all duration-300",
                        businessNameFieldState.blocked 
                          ? "border-muted bg-muted/50 cursor-not-allowed" 
                          : "border-foreground/30 bg-muted/30"
                      )}
                    />
                    {businessNameFieldState.blocked && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Business name only applicable for LLC classification
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line 3a - Federal Tax Classification */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">3a</span>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground block mb-2">
                      Check the appropriate box for federal tax classification of the entity/individual whose name is entered on line 1. Check only one of the following seven boxes.
                    </Label>
                    <RadioGroup
                      value={formData.federal_tax_classification}
                      onValueChange={handleClassificationChange}
                      className="space-y-2"
                    >
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="individual" id="individual" />
                          <Label htmlFor="individual" className="text-sm font-normal cursor-pointer">
                            Individual/sole proprietor
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="c_corporation" id="c_corporation" />
                          <Label htmlFor="c_corporation" className="text-sm font-normal cursor-pointer">C Corporation</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="s_corporation" id="s_corporation" />
                          <Label htmlFor="s_corporation" className="text-sm font-normal cursor-pointer">S Corporation</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="partnership" id="partnership" />
                          <Label htmlFor="partnership" className="text-sm font-normal cursor-pointer">Partnership</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="trust_estate" id="trust_estate" />
                          <Label htmlFor="trust_estate" className="text-sm font-normal cursor-pointer">Trust/estate</Label>
                        </div>
                      </div>
                      
                      {/* LLC Option with always-visible classification field */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="llc" id="llc" />
                          <Label htmlFor="llc" className="text-sm font-normal cursor-pointer">
                            LLC. Enter the tax classification (C=C corporation, S=S corporation, P=Partnership) ▶
                          </Label>
                        </div>
                      </div>

                      {/* LLC Classification - Always visible, conditionally enabled */}
                      <div className={cn(
                        "ml-6 flex items-center gap-2 p-2 border rounded-md transition-all duration-300",
                        llcFieldState.enabled 
                          ? "border-primary bg-primary/5" 
                          : "opacity-50 bg-muted/30 border-muted"
                      )}>
                        <Label className={cn(
                          "text-sm transition-colors duration-300",
                          !llcFieldState.enabled && "text-muted-foreground"
                        )}>
                          LLC Tax Classification:
                        </Label>
                        <select
                          value={formData.llc_tax_classification}
                          onChange={(e) => setFormData({ ...formData, llc_tax_classification: e.target.value, has_foreign_partners: false })}
                          disabled={!llcFieldState.enabled}
                          required={llcFieldState.required}
                          className={cn(
                            "h-8 px-2 rounded-md border text-sm transition-all duration-300",
                            llcFieldState.enabled 
                              ? "border-foreground/30 bg-background cursor-pointer" 
                              : "border-muted bg-muted/50 cursor-not-allowed text-muted-foreground"
                          )}
                        >
                          <option value="">Select C, S, or P</option>
                          <option value="C">C - C Corporation</option>
                          <option value="S">S - S Corporation</option>
                          <option value="P">P - Partnership</option>
                        </select>
                        {llcFieldState.required && !formData.llc_tax_classification && (
                          <span className="text-xs text-destructive">Required</span>
                        )}
                      </div>

                      {/* Other Option */}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="other" />
                        <Label htmlFor="other" className="text-sm font-normal cursor-pointer">Other (see instructions) ▶</Label>
                      </div>

                      {/* Other Classification - Always visible, conditionally enabled */}
                      <div className={cn(
                        "ml-6 flex items-center gap-2 p-2 border rounded-md transition-all duration-300",
                        otherFieldState.enabled 
                          ? "border-primary bg-primary/5" 
                          : "opacity-50 bg-muted/30 border-muted"
                      )}>
                        <Label className={cn(
                          "text-sm transition-colors duration-300",
                          !otherFieldState.enabled && "text-muted-foreground"
                        )}>
                          Specify Entity Type:
                        </Label>
                        <Input
                          value={formData.other_classification}
                          onChange={(e) => setFormData({ ...formData, other_classification: e.target.value })}
                          disabled={!otherFieldState.enabled}
                          required={otherFieldState.required}
                          placeholder="Enter entity type description"
                          className={cn(
                            "w-48 h-8 transition-all duration-300",
                            otherFieldState.enabled 
                              ? "border-foreground/30" 
                              : "border-muted bg-muted/50 cursor-not-allowed"
                          )}
                        />
                        {otherFieldState.required && !formData.other_classification && (
                          <span className="text-xs text-destructive">Required</span>
                        )}
                      </div>
                    </RadioGroup>

                    <p className="text-xs text-muted-foreground mt-3">
                      <strong>Note:</strong> Check the "LLC" box above and, in the entry space, enter the appropriate code (C, S, or P) for the tax 
                      classification of the LLC, unless it is a disregarded entity. A disregarded entity should instead check the appropriate 
                      box for the tax classification of its owner.
                    </p>
                  </div>
                </div>
              </div>

              {/* Line 3b - Foreign Partners (conditional) */}
              {showLine3b && (
                <div className="border-b border-foreground/20 p-3 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-sm w-4 flex-shrink-0">3b</span>
                    <div className="flex-1">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="has_foreign_partners"
                          checked={formData.has_foreign_partners}
                          onCheckedChange={(checked) => 
                            setFormData({ ...formData, has_foreign_partners: checked as boolean })
                          }
                        />
                        <Label htmlFor="has_foreign_partners" className="text-sm leading-relaxed cursor-pointer">
                          If on line 3a you checked "Partnership" or "Trust/estate," or checked "LLC" and entered "P" as its tax classification, 
                          and you are providing this form to a partnership, trust, or estate in which you have an ownership interest, check this box 
                          if you have any <strong>foreign partners, owners, or beneficiaries</strong>. See instructions.
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Line 4 - Exemptions */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">4</span>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground block mb-2">
                      Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Exempt payee code (if any)</span>
                        <Input
                          value={formData.exempt_payee_code}
                          onChange={(e) => setFormData({ ...formData, exempt_payee_code: e.target.value })}
                          className="w-16 h-7 text-center border-foreground/30 font-mono"
                          maxLength={2}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Exemption from FATCA reporting code (if any)</span>
                        <Input
                          value={formData.fatca_exemption_code}
                          onChange={(e) => setFormData({ ...formData, fatca_exemption_code: e.target.value })}
                          className="w-16 h-7 text-center border-foreground/30 font-mono"
                          maxLength={2}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      (Applies to accounts maintained outside the U.S.)
                    </p>
                  </div>
                </div>
              </div>

              {/* Line 5 - Address */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">5</span>
                  <div className="flex-1">
                    <Label htmlFor="address" className="text-xs text-muted-foreground">
                      Address (number, street, and apt. or suite no.). See instructions.
                    </Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="mt-1 border-foreground/30 bg-muted/30"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Line 6 - City, State, ZIP */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">6</span>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground block mb-1">City, state, and ZIP code</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="City"
                        className="border-foreground/30 bg-muted/30"
                        required
                      />
                      <select
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-foreground/30 bg-muted/30 px-3 py-2 text-sm"
                        required
                      >
                        <option value="">State</option>
                        {US_STATES.map((state) => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                      <Input
                        value={formData.zip}
                        onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                        placeholder="ZIP code"
                        className="border-foreground/30 bg-muted/30"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Line 7 - Account Numbers */}
              <div className="border-b border-foreground/20 p-3">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-sm w-4 flex-shrink-0">7</span>
                  <div className="flex-1">
                    <Label htmlFor="account_numbers" className="text-xs text-muted-foreground">
                      List account number(s) here (optional)
                    </Label>
                    <Input
                      id="account_numbers"
                      value={formData.account_numbers}
                      onChange={(e) => setFormData({ ...formData, account_numbers: e.target.value })}
                      className="mt-1 border-foreground/30 bg-muted/30"
                    />
                  </div>
                </div>
              </div>

              {/* Part I - TIN */}
              <div className="bg-slate-800 text-white px-3 py-2 flex items-center gap-4">
                <span className="font-bold">Part I</span>
                <span>Taxpayer Identification Number (TIN)</span>
              </div>
              <div className="border-b border-foreground/20 p-4">
                <p className="text-sm mb-4">
                  Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid 
                  backup withholding. For individuals, this is generally your social security number (SSN). However, for a 
                  resident alien, sole proprietor, or disregarded entity, see the instructions for Part I, later. For other 
                  entities, it is your employer identification number (EIN). If you do not have a number, see How to get a 
                  TIN, later.
                </p>

                {/* TIN Requirement Notice */}
                {tinRequirements.einRequired && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md transition-all duration-300">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span><strong>Note:</strong> Corporations and partnerships must use an Employer Identification Number (EIN).</span>
                    </p>
                  </div>
                )}

                {tinRequirements.ssnPreferred && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md transition-all duration-300">
                    <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span><strong>Tip:</strong> Individuals/sole proprietors typically use their Social Security Number (SSN), but may also use an EIN if they have one.</span>
                    </p>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-6">
                  {/* SSN Section */}
                  <div className={cn(
                    "flex-1 border rounded-md p-4 transition-all duration-300 relative",
                    tinRequirements.ssnPreferred && "border-primary ring-2 ring-primary/20 bg-primary/5",
                    tinRequirements.einRequired && "opacity-50 bg-muted/30 border-muted cursor-not-allowed",
                    !tinRequirements.ssnPreferred && !tinRequirements.einRequired && "border-foreground/20"
                  )}>
                    {/* Blocked overlay indicator */}
                    {tinRequirements.einRequired && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted">
                          N/A
                        </Badge>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="radio"
                        id="tin_ssn"
                        name="tin_type"
                        checked={formData.tin_type === "ssn"}
                        onChange={() => setFormData({ ...formData, tin_type: "ssn" })}
                        disabled={tinRequirements.einRequired}
                        className={cn("h-4 w-4", tinRequirements.einRequired && "cursor-not-allowed")}
                      />
                      <Label htmlFor="tin_ssn" className={cn(
                        "font-semibold transition-colors duration-300",
                        tinRequirements.einRequired ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"
                      )}>
                        Social security number
                      </Label>
                      {tinRequirements.ssnPreferred && (
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      )}
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 font-mono text-lg transition-opacity duration-300",
                      tinRequirements.einRequired && "opacity-30 pointer-events-none"
                    )}>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <span className="mx-1">-</span>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        X
                      </div>
                      <span className="mx-1">-</span>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        {personnel?.ssn_last_four?.[0] || "X"}
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        {personnel?.ssn_last_four?.[1] || "X"}
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        {personnel?.ssn_last_four?.[2] || "X"}
                      </div>
                      <div className="w-10 h-8 border border-foreground/40 rounded flex items-center justify-center bg-muted/50">
                        {personnel?.ssn_last_four?.[3] || "X"}
                      </div>
                    </div>
                    <p className={cn(
                      "text-xs mt-2",
                      tinRequirements.einRequired ? "text-muted-foreground" : "text-muted-foreground"
                    )}>
                      {tinRequirements.einRequired 
                        ? "SSN not applicable for this classification"
                        : formData.tin_type === "ssn" 
                          ? "Your SSN on file will be used. Contact your administrator to update."
                          : "Select if using your Social Security Number"}
                    </p>
                  </div>

                  <div className="text-center self-center font-bold text-muted-foreground">
                    or
                  </div>

                  {/* EIN Section */}
                  <div className={cn(
                    "flex-1 border rounded-md p-4 transition-all duration-300",
                    tinRequirements.einRequired && "border-primary ring-2 ring-primary/20 bg-primary/5",
                    !tinRequirements.einRequired && "border-foreground/20"
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="radio"
                        id="tin_ein"
                        name="tin_type"
                        checked={formData.tin_type === "ein"}
                        onChange={() => setFormData({ ...formData, tin_type: "ein" })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="tin_ein" className="font-semibold cursor-pointer">
                        Employer identification number
                      </Label>
                      {tinRequirements.einRequired && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                    {formData.tin_type === "ein" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={formData.ein.slice(0, 2)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                            const rest = formData.ein.slice(2);
                            setFormData({ ...formData, ein: val + rest });
                          }}
                          className="w-14 h-8 text-center font-mono border-foreground/40"
                          maxLength={2}
                          placeholder="XX"
                          required={tinRequirements.einRequired}
                        />
                        <span className="font-mono">-</span>
                        <Input
                          value={formData.ein.slice(2)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 7);
                            const prefix = formData.ein.slice(0, 2);
                            setFormData({ ...formData, ein: prefix + val });
                          }}
                          className="w-28 h-8 text-center font-mono border-foreground/40"
                          maxLength={7}
                          placeholder="XXXXXXX"
                          required={tinRequirements.einRequired}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 font-mono text-lg text-muted-foreground">
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <span className="mx-1">-</span>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                        <div className="w-10 h-8 border border-foreground/20 rounded flex items-center justify-center bg-muted/30">
                          
                        </div>
                      </div>
                    )}
                    {tinRequirements.einRequired && formData.tin_type === "ein" && formData.ein.length < 9 && (
                      <p className="text-xs text-destructive mt-2">
                        EIN is required for this entity type. Please enter a valid 9-digit EIN.
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-4">
                  <strong>Note:</strong> If the account is in more than one name, see the instructions for line 1. Also see What Name and 
                  Number To Give the Requester for guidelines on whose number to enter.
                </p>
              </div>

              {/* Part II - Certification */}
              <div className="bg-slate-800 text-white px-3 py-2 flex items-center gap-4">
                <span className="font-bold">Part II</span>
                <span>Certification</span>
              </div>
              <div className="border-b border-foreground/20 p-4">
                <p className="font-semibold mb-3">Under penalties of perjury, I certify that:</p>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_correct_tin"
                      checked={formData.certified_correct_tin}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_correct_tin: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_correct_tin" className="text-sm leading-relaxed cursor-pointer">
                      <strong>1.</strong> The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_not_subject_backup_withholding"
                      checked={formData.certified_not_subject_backup_withholding}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_not_subject_backup_withholding: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_not_subject_backup_withholding" className="text-sm leading-relaxed cursor-pointer">
                      <strong>2.</strong> I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_us_person"
                      checked={formData.certified_us_person}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_us_person: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_us_person" className="text-sm leading-relaxed cursor-pointer">
                      <strong>3.</strong> I am a U.S. citizen or other U.S. person (defined below); and
                    </Label>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_fatca_exempt"
                      checked={formData.certified_fatca_exempt}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_fatca_exempt: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_fatca_exempt" className="text-sm leading-relaxed cursor-pointer">
                      <strong>4.</strong> The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.
                    </Label>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-muted/50 rounded-md border border-foreground/20">
                  <p className="text-sm">
                    <strong>Certification instructions.</strong> You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return. For real estate transactions, item 2 does not apply. For mortgage interest paid, acquisition or abandonment of secured property, cancellation of debt, contributions to an individual retirement arrangement (IRA), and generally, payments other than interest and dividends, you are not required to sign the certification, but you must provide your correct TIN. See the instructions for Part II, later.
                  </p>
                </div>
              </div>

              {/* Sign Here */}
              <div className="bg-slate-800 text-white px-3 py-1 text-sm">
                <span className="font-bold">Sign Here</span>
              </div>
              <div className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">Signature of U.S. person ▶</Label>
                    <Input
                      value={formData.signature_data}
                      onChange={(e) => setFormData({ ...formData, signature_data: e.target.value })}
                      className="border-foreground/40 bg-muted/30 italic font-serif text-lg h-12"
                      placeholder="Type your full legal name to sign"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      By typing your name above, you are electronically signing this W-9 form.
                    </p>
                  </div>
                  <div className="md:w-48">
                    <Label className="text-xs text-muted-foreground mb-1 block">Date ▶</Label>
                    <Input
                      value={format(new Date(), "MM/dd/yyyy")}
                      readOnly
                      className="border-foreground/40 bg-muted/50 h-12"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Submit Buttons */}
              <div className="p-4 flex gap-3">
                <Button
                  type="submit"
                  disabled={
                    submitW9.isPending || 
                    !formData.signature_data || 
                    !formData.federal_tax_classification ||
                    // LLC requires classification selection
                    (formData.federal_tax_classification === "llc" && !formData.llc_tax_classification) ||
                    // Other requires description
                    (formData.federal_tax_classification === "other" && !formData.other_classification) ||
                    // Corporations/partnerships require valid EIN
                    (["c_corporation", "s_corporation", "partnership"].includes(formData.federal_tax_classification) && 
                      (formData.tin_type !== "ein" || formData.ein.length < 9))
                  }
                  className="min-w-32"
                >
                  {submitW9.isPending ? "Submitting..." : "Submit W-9 Form"}
                </Button>
                {isEditing && (
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
