import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Employee {
  name: string;
  address: string;
  ssnLastFour: string;
  withholdingExemptions: number;
  workClassification: string;
  dailyHours: { straight: number; overtime: number }[];
  totalHours: { straight: number; overtime: number };
  rateOfPay: { straight: number; overtime: number };
  grossEarned: number;
  deductions: { fica: number; withholding: number; other: number };
  totalDeductions: number;
  netWages: number;
}

interface WH347FormData {
  contractorName: string;
  contractorAddress: string;
  isSubcontractor: boolean;
  payrollNumber: string;
  weekEnding: string;
  projectName: string;
  projectLocation: string;
  contractNumber: string;
  employees: Employee[];
  signatory: {
    name: string;
    title: string;
    date: string;
  };
  fringeBenefits: {
    paidToPlans: boolean;
    paidInCash: boolean;
  };
}

// Helper to safely set text field with multiple name pattern fallbacks
function setTextField(
  form: any,
  fieldNames: string[],
  value: string,
  allFieldNames: string[]
): boolean {
  for (const name of fieldNames) {
    // Try exact match first
    if (allFieldNames.includes(name)) {
      try {
        const field = form.getTextField(name);
        field.setText(value || "");
        return true;
      } catch (e) {
        console.log(`Field ${name} exists but failed to set:`, e);
      }
    }
    // Try partial match
    const match = allFieldNames.find(
      (f) => f.toLowerCase().includes(name.toLowerCase())
    );
    if (match) {
      try {
        const field = form.getTextField(match);
        field.setText(value || "");
        return true;
      } catch (e) {
        console.log(`Field ${match} exists but failed to set:`, e);
      }
    }
  }
  return false;
}

// Helper to safely check a checkbox
function setCheckbox(
  form: any,
  fieldNames: string[],
  checked: boolean,
  allFieldNames: string[]
): boolean {
  for (const name of fieldNames) {
    if (allFieldNames.includes(name)) {
      try {
        const field = form.getCheckBox(name);
        if (checked) {
          field.check();
        } else {
          field.uncheck();
        }
        return true;
      } catch (e) {
        console.log(`Checkbox ${name} failed:`, e);
      }
    }
    const match = allFieldNames.find(
      (f) => f.toLowerCase().includes(name.toLowerCase())
    );
    if (match) {
      try {
        const field = form.getCheckBox(match);
        if (checked) {
          field.check();
        } else {
          field.uncheck();
        }
        return true;
      } catch (e) {
        console.log(`Checkbox ${match} failed:`, e);
      }
    }
  }
  return false;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formData } = (await req.json()) as { formData: WH347FormData };

    if (!formData) {
      return new Response(JSON.stringify({ error: "No form data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the official WH-347 template from storage
    console.log("Downloading WH-347 template from storage...");
    const { data: templateData, error: downloadError } = await supabase.storage
      .from("form-templates")
      .download("wh-347-348-fillable.pdf");

    if (downloadError || !templateData) {
      console.error("Failed to download template:", downloadError);
      return new Response(
        JSON.stringify({
          error: "Failed to download WH-347 template",
          details: downloadError?.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load the PDF template
    const templateBytes = await templateData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Get all field names for debugging and matching
    const fields = form.getFields();
    const allFieldNames = fields.map((f) => f.getName());
    console.log("Available PDF fields:", JSON.stringify(allFieldNames, null, 2));

    // Fill header fields - try multiple naming patterns
    setTextField(
      form,
      ["PayrollNo", "Payroll No", "payrollno", "topmostSubform[0].Page1[0].PayrollNo[0]"],
      formData.payrollNumber,
      allFieldNames
    );

    setTextField(
      form,
      ["WeekEnding", "Week Ending", "weekending", "ForWeekEnding", "topmostSubform[0].Page1[0].WeekEnding[0]"],
      formData.weekEnding,
      allFieldNames
    );

    // Contractor or subcontractor name
    const contractorLabel = formData.isSubcontractor ? "Subcontractor" : "Contractor";
    setTextField(
      form,
      ["ContractorName", "Contractor", "Name1", "NameofContractor", "topmostSubform[0].Page1[0].Contractor[0]"],
      formData.contractorName,
      allFieldNames
    );

    setTextField(
      form,
      ["ContractorAddress", "Address1", "Address", "topmostSubform[0].Page1[0].Address[0]"],
      formData.contractorAddress,
      allFieldNames
    );

    setTextField(
      form,
      ["ProjectName", "Project", "ProjectandLocation", "topmostSubform[0].Page1[0].Project[0]"],
      `${formData.projectName} - ${formData.projectLocation}`,
      allFieldNames
    );

    setTextField(
      form,
      ["ContractNo", "Contract", "ContractNumber", "topmostSubform[0].Page1[0].ContractNo[0]"],
      formData.contractNumber,
      allFieldNames
    );

    // Fill employee rows (up to 8 employees per page typically)
    const maxEmployees = Math.min(formData.employees.length, 8);
    const dayNames = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

    for (let i = 0; i < maxEmployees; i++) {
      const emp = formData.employees[i];
      const rowNum = i + 1;

      // Employee name and address
      setTextField(
        form,
        [`Name${rowNum}`, `NameRow${rowNum}`, `Employee${rowNum}`, `topmostSubform[0].Page1[0].Name${rowNum}[0]`],
        emp.name,
        allFieldNames
      );

      setTextField(
        form,
        [`Address${rowNum}`, `AddressRow${rowNum}`, `topmostSubform[0].Page1[0].Address${rowNum}[0]`],
        emp.address,
        allFieldNames
      );

      // SSN last four (for identification)
      setTextField(
        form,
        [`SSN${rowNum}`, `LastFour${rowNum}`, `NO${rowNum}`, `topmostSubform[0].Page1[0].NO${rowNum}[0]`],
        emp.ssnLastFour ? `XXX-XX-${emp.ssnLastFour}` : "",
        allFieldNames
      );

      // Withholding exemptions
      setTextField(
        form,
        [`WH${rowNum}`, `Exemptions${rowNum}`, `WithholdingExemptions${rowNum}`, `topmostSubform[0].Page1[0].WH${rowNum}[0]`],
        emp.withholdingExemptions.toString(),
        allFieldNames
      );

      // Work classification
      setTextField(
        form,
        [`Class${rowNum}`, `Classification${rowNum}`, `WorkClass${rowNum}`, `topmostSubform[0].Page1[0].Class${rowNum}[0]`],
        emp.workClassification,
        allFieldNames
      );

      // Daily hours - WH-347 has separate O (overtime) and S (straight) rows
      for (let d = 0; d < 7; d++) {
        const dayHours = emp.dailyHours[d] || { straight: 0, overtime: 0 };

        // Straight time row (S)
        if (dayHours.straight > 0) {
          setTextField(
            form,
            [
              `S${dayNames[d]}${rowNum}`,
              `${dayNames[d]}S${rowNum}`,
              `Straight${dayNames[d]}${rowNum}`,
              `topmostSubform[0].Page1[0].S${dayNames[d]}${rowNum}[0]`,
            ],
            dayHours.straight.toString(),
            allFieldNames
          );
        }

        // Overtime row (O)
        if (dayHours.overtime > 0) {
          setTextField(
            form,
            [
              `O${dayNames[d]}${rowNum}`,
              `${dayNames[d]}O${rowNum}`,
              `OT${dayNames[d]}${rowNum}`,
              `topmostSubform[0].Page1[0].O${dayNames[d]}${rowNum}[0]`,
            ],
            dayHours.overtime.toString(),
            allFieldNames
          );
        }
      }

      // Total hours
      setTextField(
        form,
        [`TotalS${rowNum}`, `TotalStraight${rowNum}`, `topmostSubform[0].Page1[0].TotalS${rowNum}[0]`],
        emp.totalHours.straight.toString(),
        allFieldNames
      );

      setTextField(
        form,
        [`TotalO${rowNum}`, `TotalOT${rowNum}`, `topmostSubform[0].Page1[0].TotalO${rowNum}[0]`],
        emp.totalHours.overtime.toString(),
        allFieldNames
      );

      // Rate of pay
      setTextField(
        form,
        [`RateS${rowNum}`, `StraightRate${rowNum}`, `topmostSubform[0].Page1[0].RateS${rowNum}[0]`],
        emp.rateOfPay.straight.toFixed(2),
        allFieldNames
      );

      setTextField(
        form,
        [`RateO${rowNum}`, `OTRate${rowNum}`, `topmostSubform[0].Page1[0].RateO${rowNum}[0]`],
        emp.rateOfPay.overtime.toFixed(2),
        allFieldNames
      );

      // Gross earned
      setTextField(
        form,
        [`Gross${rowNum}`, `GrossEarned${rowNum}`, `topmostSubform[0].Page1[0].Gross${rowNum}[0]`],
        emp.grossEarned.toFixed(2),
        allFieldNames
      );

      // Deductions
      setTextField(
        form,
        [`FICA${rowNum}`, `Fica${rowNum}`, `topmostSubform[0].Page1[0].FICA${rowNum}[0]`],
        emp.deductions.fica.toFixed(2),
        allFieldNames
      );

      setTextField(
        form,
        [`WT${rowNum}`, `Withholding${rowNum}`, `topmostSubform[0].Page1[0].WT${rowNum}[0]`],
        emp.deductions.withholding.toFixed(2),
        allFieldNames
      );

      setTextField(
        form,
        [`Other${rowNum}`, `OtherDed${rowNum}`, `topmostSubform[0].Page1[0].Other${rowNum}[0]`],
        emp.deductions.other.toFixed(2),
        allFieldNames
      );

      setTextField(
        form,
        [`TotalDed${rowNum}`, `TotalDeductions${rowNum}`, `topmostSubform[0].Page1[0].TotalDed${rowNum}[0]`],
        emp.totalDeductions.toFixed(2),
        allFieldNames
      );

      // Net wages
      setTextField(
        form,
        [`Net${rowNum}`, `NetWages${rowNum}`, `topmostSubform[0].Page1[0].Net${rowNum}[0]`],
        emp.netWages.toFixed(2),
        allFieldNames
      );
    }

    // Fringe benefits checkboxes (Page 2 - Statement of Compliance WH-348)
    setCheckbox(
      form,
      ["FringePaidToPlans", "PaidToPlans", "FringePlans", "topmostSubform[0].Page2[0].FringePaidToPlans[0]"],
      formData.fringeBenefits.paidToPlans,
      allFieldNames
    );

    setCheckbox(
      form,
      ["FringePaidInCash", "PaidInCash", "FringeCash", "topmostSubform[0].Page2[0].FringePaidInCash[0]"],
      formData.fringeBenefits.paidInCash,
      allFieldNames
    );

    // Signatory information (Page 2)
    setTextField(
      form,
      ["SignatoryName", "Signature", "Name", "topmostSubform[0].Page2[0].SignatoryName[0]"],
      formData.signatory.name,
      allFieldNames
    );

    setTextField(
      form,
      ["SignatoryTitle", "Title", "topmostSubform[0].Page2[0].SignatoryTitle[0]"],
      formData.signatory.title,
      allFieldNames
    );

    setTextField(
      form,
      ["SignatoryDate", "Date", "SignDate", "topmostSubform[0].Page2[0].SignatoryDate[0]"],
      formData.signatory.date,
      allFieldNames
    );

    // Flatten the form to make it non-editable
    form.flatten();

    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();

    console.log("WH-347 PDF generated successfully");

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="WH-347.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating WH-347:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate WH-347 PDF",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
