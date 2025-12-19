import { useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useCurrentPersonnel } from "@/integrations/supabase/hooks/usePortal";
import { useCurrentPersonnelW9Form, useSubmitW9Form, W9FormInput } from "@/integrations/supabase/hooks/useW9Forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertCircle, FileText, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";

const FEDERAL_TAX_CLASSIFICATIONS = [
  { value: "individual", label: "Individual/sole proprietor or single-member LLC" },
  { value: "c_corporation", label: "C Corporation" },
  { value: "s_corporation", label: "S Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust/estate" },
  { value: "llc", label: "Limited liability company" },
  { value: "other", label: "Other" },
];

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

  // Pre-populate form when personnel data is loaded
  useState(() => {
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
  });

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
    return (
      <PortalLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tax Forms</h1>
              <p className="text-muted-foreground">View and manage your tax documentation</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>W-9 Form</CardTitle>
                    <CardDescription>Request for Taxpayer Identification Number and Certification</CardDescription>
                  </div>
                </div>
                {getStatusBadge(w9Form.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {w9Form.status === "rejected" && w9Form.rejection_reason && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>W-9 Rejected</AlertTitle>
                  <AlertDescription>{w9Form.rejection_reason}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground text-xs">Name (as shown on tax return)</Label>
                  <p className="font-medium">{w9Form.name_on_return}</p>
                </div>
                {w9Form.business_name && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Business Name</Label>
                    <p className="font-medium">{w9Form.business_name}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground text-xs">Federal Tax Classification</Label>
                  <p className="font-medium capitalize">{w9Form.federal_tax_classification.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">TIN Type</Label>
                  <p className="font-medium uppercase">{w9Form.tin_type}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground text-xs">Address</Label>
                <p className="font-medium">
                  {w9Form.address}<br />
                  {w9Form.city}, {w9Form.state} {w9Form.zip}
                </p>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground text-xs">Signature Date</Label>
                  <p className="font-medium">{format(new Date(w9Form.signature_date), "MMMM d, yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Last Updated</Label>
                  <p className="font-medium">{format(new Date(w9Form.updated_at), "MMMM d, yyyy")}</p>
                </div>
              </div>

              {w9Form.status !== "verified" && (
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  Edit W-9 Form
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }

  // Show W-9 form input
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              W-9 Form
            </CardTitle>
            <CardDescription>
              Request for Taxpayer Identification Number and Certification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Part 1: Identification */}
              <div className="space-y-4">
                <h3 className="font-semibold">Part I: Identification</h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name_on_return">Name (as shown on your income tax return) *</Label>
                    <Input
                      id="name_on_return"
                      value={formData.name_on_return}
                      onChange={(e) => setFormData({ ...formData, name_on_return: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business name/disregarded entity name (if different)</Label>
                    <Input
                      id="business_name"
                      value={formData.business_name}
                      onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="federal_tax_classification">Federal tax classification *</Label>
                  <Select
                    value={formData.federal_tax_classification}
                    onValueChange={(value) => setFormData({ ...formData, federal_tax_classification: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEDERAL_TAX_CLASSIFICATIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.federal_tax_classification === "llc" && (
                  <div className="space-y-2">
                    <Label htmlFor="llc_tax_classification">LLC Tax Classification</Label>
                    <Select
                      value={formData.llc_tax_classification}
                      onValueChange={(value) => setFormData({ ...formData, llc_tax_classification: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select LLC classification" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="C">C Corporation</SelectItem>
                        <SelectItem value="S">S Corporation</SelectItem>
                        <SelectItem value="P">Partnership</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.federal_tax_classification === "other" && (
                  <div className="space-y-2">
                    <Label htmlFor="other_classification">Other Classification</Label>
                    <Input
                      id="other_classification"
                      value={formData.other_classification}
                      onChange={(e) => setFormData({ ...formData, other_classification: e.target.value })}
                      placeholder="Specify classification"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Address */}
              <div className="space-y-4">
                <h3 className="font-semibold">Address</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => setFormData({ ...formData, state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
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
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code *</Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Part I: TIN */}
              <div className="space-y-4">
                <h3 className="font-semibold">Part I: Taxpayer Identification Number (TIN)</h3>
                
                <div className="space-y-2">
                  <Label>TIN Type *</Label>
                  <Select
                    value={formData.tin_type}
                    onValueChange={(value: "ssn" | "ein") => setFormData({ ...formData, tin_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ssn">Social Security Number (SSN)</SelectItem>
                      <SelectItem value="ein">Employer Identification Number (EIN)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.tin_type === "ssn" ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your SSN on file will be used for this W-9. If you need to update your SSN, please contact your administrator.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="ein">Employer Identification Number (EIN)</Label>
                    <Input
                      id="ein"
                      value={formData.ein}
                      onChange={(e) => setFormData({ ...formData, ein: e.target.value })}
                      placeholder="XX-XXXXXXX"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Part II: Certification */}
              <div className="space-y-4">
                <h3 className="font-semibold">Part II: Certification</h3>
                <p className="text-sm text-muted-foreground">
                  Under penalties of perjury, I certify that:
                </p>

                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="certified_correct_tin"
                      checked={formData.certified_correct_tin}
                      onCheckedChange={(checked) => 
                        setFormData({ ...formData, certified_correct_tin: checked as boolean })
                      }
                    />
                    <Label htmlFor="certified_correct_tin" className="text-sm leading-relaxed">
                      1. The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me)
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
                    <Label htmlFor="certified_not_subject_backup_withholding" className="text-sm leading-relaxed">
                      2. I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the IRS that I am subject to backup withholding
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
                    <Label htmlFor="certified_us_person" className="text-sm leading-relaxed">
                      3. I am a U.S. citizen or other U.S. person
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
                    <Label htmlFor="certified_fatca_exempt" className="text-sm leading-relaxed">
                      4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Signature */}
              <div className="space-y-4">
                <h3 className="font-semibold">Electronic Signature</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="signature_data">Type your full legal name to sign *</Label>
                  <Input
                    id="signature_data"
                    value={formData.signature_data}
                    onChange={(e) => setFormData({ ...formData, signature_data: e.target.value })}
                    placeholder="Your full legal name"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    By typing your name above, you are electronically signing this W-9 form and certifying that the information provided is true and correct.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={submitW9.isPending || !formData.signature_data || !formData.federal_tax_classification}
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
