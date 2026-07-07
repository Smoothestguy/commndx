import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { W9TaxForm } from "@/components/personnel/onboarding/W9TaxForm";
import { W9FormPreview } from "@/components/personnel/W9FormPreview";
import type { W9Form } from "@/integrations/supabase/hooks/useW9Forms";

const SAMPLE_PERSONNEL = {
  first_name: "Jane",
  last_name: "Doe",
  address: "123 Sample Street",
  city: "Miami",
  state: "FL",
  zip: "33101",
  ssn_full: "123456789",
};

const SAMPLE_W9: W9Form = {
  id: "preview-sample",
  personnel_id: "preview-sample",
  name_on_return: "Jane Doe",
  business_name: null,
  federal_tax_classification: "individual",
  llc_tax_classification: null,
  other_classification: null,
  has_foreign_partners: false,
  exempt_payee_code: null,
  fatca_exemption_code: null,
  address: "123 Sample Street",
  city: "Miami",
  state: "FL",
  zip: "33101",
  account_numbers: null,
  tin_type: "ssn",
  ein: null,
  signature_data: "Jane Doe",
  signature_date: new Date().toISOString(),
  certified_us_person: true,
  certified_correct_tin: true,
  certified_not_subject_backup_withholding: true,
  certified_fatca_exempt: false,
  document_url: null,
  status: "verified",
  verified_by: null,
  verified_at: new Date().toISOString(),
  rejection_reason: null,
  edit_allowed: false,
  edit_allowed_until: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function W9Preview() {
  const [view, setView] = useState<"onboarding" | "completed">("onboarding");
  const [formData, setFormData] = useState({
    tax_classification: "individual",
    tax_ein: "",
    tax_business_name: "",
    w9_signature: null as string | null,
    w9_certification: false,
  });

  const handleChange = (field: string, value: string | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">W-9 Preview</h1>
        <p className="text-muted-foreground">
          Admin-only preview of the W-9 forms. No data is saved.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={view === "onboarding" ? "default" : "outline"}
          onClick={() => setView("onboarding")}
        >
          Onboarding W-9 (fillable)
        </Button>
        <Button
          variant={view === "completed" ? "default" : "outline"}
          onClick={() => setView("completed")}
        >
          Completed W-9 (review view)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {view === "onboarding"
              ? "Onboarding step — as workers see it"
              : "Reviewed W-9 — as admins see it"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {view === "onboarding" ? (
            <W9TaxForm
              data={formData}
              onChange={handleChange}
              personnelData={SAMPLE_PERSONNEL}
            />
          ) : (
            <W9FormPreview
              w9Form={SAMPLE_W9}
              ssnLastFour="6789"
              ssnFull="123456789"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
