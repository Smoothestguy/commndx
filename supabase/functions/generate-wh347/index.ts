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
        console.log(`Set field ${name} = "${value}"`);
        return true;
      } catch (e) {
        console.log(`Field ${name} exists but failed to set:`, e);
      }
    }
    // Try partial match (case-insensitive)
    const match = allFieldNames.find(
      (f) => f.toLowerCase() === name.toLowerCase()
    );
    if (match) {
      try {
        const field = form.getTextField(match);
        field.setText(value || "");
        console.log(`Set field ${match} (matched from ${name}) = "${value}"`);
        return true;
      } catch (e) {
        console.log(`Field ${match} exists but failed to set:`, e);
      }
    }
  }
  console.log(`No match found for fields: ${fieldNames.join(", ")}`);
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
      (f) => f.toLowerCase() === name.toLowerCase()
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

    // ============================================
    // HEADER FIELDS - Using actual PDF field names
    // ============================================
    
    // Contractor name
    setTextField(
      form,
      ["contractor", "Contractor"],
      formData.contractorName,
      allFieldNames
    );

    // Contractor address
    setTextField(
      form,
      ["address", "Address"],
      formData.contractorAddress,
      allFieldNames
    );

    // Payroll number
    setTextField(
      form,
      ["payrollNo", "PayrollNo", "payrollNumber"],
      formData.payrollNumber,
      allFieldNames
    );

    // Week ending date
    setTextField(
      form,
      ["weekEnding", "WeekEnding", "forWeekEnding"],
      formData.weekEnding,
      allFieldNames
    );

    // Project and location (combined field)
    setTextField(
      form,
      ["projectAndLocation", "ProjectAndLocation", "project"],
      `${formData.projectName} - ${formData.projectLocation}`,
      allFieldNames
    );

    // Contract number (if field exists)
    setTextField(
      form,
      ["contractNo", "ContractNo", "contractNumber"],
      formData.contractNumber,
      allFieldNames
    );

    // ============================================
    // EMPLOYEE ROWS - Using actual PDF field names
    // ============================================
    const maxEmployees = Math.min(formData.employees.length, 8);
    console.log(`Processing ${maxEmployees} employees...`);

    for (let i = 0; i < maxEmployees; i++) {
      const emp = formData.employees[i];
      const rowNum = i + 1;
      
      console.log(`\n--- Employee ${rowNum}: ${emp.name} ---`);

      // Combined Name/Address/SSN field (nameAddrSSN1, nameAddrSSN2, etc.)
      // Format: Name on first line, address on second, SSN on third
      const ssnMasked = emp.ssnLastFour ? `XXX-XX-${emp.ssnLastFour}` : "";
      const nameAddrSsnValue = [
        emp.name,
        emp.address || "",
        ssnMasked
      ].filter(Boolean).join("\n");
      
      setTextField(
        form,
        [`nameAddrSSN${rowNum}`, `NameAddrSSN${rowNum}`],
        nameAddrSsnValue,
        allFieldNames
      );

      // Withholding exemptions (noWithholdingExemptions1, etc.)
      setTextField(
        form,
        [`noWithholdingExemptions${rowNum}`, `NoWithholdingExemptions${rowNum}`, `wh${rowNum}`],
        emp.withholdingExemptions.toString(),
        allFieldNames
      );

      // Work classification (workClassification1, etc.)
      setTextField(
        form,
        [`workClassification${rowNum}`, `WorkClassification${rowNum}`],
        emp.workClassification,
        allFieldNames
      );

      // Daily hours - PDF uses day numbers 1-7
      // OT11 = Row 1, Day 1 Overtime; ST27 = Row 2, Day 7 Straight Time
      for (let d = 0; d < 7; d++) {
        const dayHours = emp.dailyHours[d] || { straight: 0, overtime: 0 };
        const dayNum = d + 1;

        // Overtime hours (OT11, OT12, ... OT17 for row 1)
        if (dayHours.overtime > 0) {
          setTextField(
            form,
            [`OT${rowNum}${dayNum}`, `ot${rowNum}${dayNum}`],
            dayHours.overtime.toString(),
            allFieldNames
          );
        }

        // Straight time hours (ST11, ST12, ... ST17 for row 1)
        if (dayHours.straight > 0) {
          setTextField(
            form,
            [`ST${rowNum}${dayNum}`, `st${rowNum}${dayNum}`],
            dayHours.straight.toString(),
            allFieldNames
          );
        }
      }

      // Total hours - overtime
      setTextField(
        form,
        [`totalHoursOT${rowNum}`, `TotalHoursOT${rowNum}`],
        emp.totalHours.overtime.toString(),
        allFieldNames
      );

      // Total hours - straight time
      setTextField(
        form,
        [`totalHoursST${rowNum}`, `TotalHoursST${rowNum}`],
        emp.totalHours.straight.toString(),
        allFieldNames
      );

      // Rate of pay - overtime
      setTextField(
        form,
        [`rateOfPayOT${rowNum}`, `RateOfPayOT${rowNum}`],
        emp.rateOfPay.overtime.toFixed(2),
        allFieldNames
      );

      // Rate of pay - straight time
      setTextField(
        form,
        [`rateOfPayST${rowNum}`, `RateOfPayST${rowNum}`],
        emp.rateOfPay.straight.toFixed(2),
        allFieldNames
      );

      // Gross earned
      setTextField(
        form,
        [`gross${rowNum}`, `Gross${rowNum}`],
        emp.grossEarned.toFixed(2),
        allFieldNames
      );

      // Deductions - FICA
      setTextField(
        form,
        [`fica${rowNum}`, `FICA${rowNum}`],
        emp.deductions.fica.toFixed(2),
        allFieldNames
      );

      // Deductions - Withholding
      setTextField(
        form,
        [`withholding${rowNum}`, `Withholding${rowNum}`],
        emp.deductions.withholding.toFixed(2),
        allFieldNames
      );

      // Deductions - Other
      setTextField(
        form,
        [`other${rowNum}`, `Other${rowNum}`],
        emp.deductions.other.toFixed(2),
        allFieldNames
      );

      // Total deductions
      setTextField(
        form,
        [`totalDeductions${rowNum}`, `TotalDeductions${rowNum}`],
        emp.totalDeductions.toFixed(2),
        allFieldNames
      );

      // Net wages
      setTextField(
        form,
        [`netWages${rowNum}`, `NetWages${rowNum}`],
        emp.netWages.toFixed(2),
        allFieldNames
      );
    }

    // ============================================
    // PAGE 2 - Statement of Compliance (WH-348)
    // ============================================
    
    // Fringe benefits checkboxes
    setCheckbox(
      form,
      ["fringePaidToPlans", "FringePaidToPlans", "paidToPlans"],
      formData.fringeBenefits.paidToPlans,
      allFieldNames
    );

    setCheckbox(
      form,
      ["fringePaidInCash", "FringePaidInCash", "paidInCash"],
      formData.fringeBenefits.paidInCash,
      allFieldNames
    );

    // Signatory information
    setTextField(
      form,
      ["signatoryName", "SignatoryName", "signature", "name"],
      formData.signatory.name,
      allFieldNames
    );

    setTextField(
      form,
      ["signatoryTitle", "SignatoryTitle", "title"],
      formData.signatory.title,
      allFieldNames
    );

    setTextField(
      form,
      ["signatoryDate", "SignatoryDate", "signDate", "date"],
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
