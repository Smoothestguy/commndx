import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface W9FormData {
  name_on_return: string;
  business_name?: string | null;
  federal_tax_classification: string;
  llc_tax_classification?: string | null;
  other_classification?: string | null;
  exempt_payee_code?: string | null;
  fatca_exemption_code?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  account_numbers?: string | null;
  tin_type?: string | null;
  ein?: string | null;
  signature_data?: string | null;
  signature_date?: string | null;
  has_foreign_partners?: boolean;
}

interface Generate1099Data {
  taxYear: number;
  company: {
    company_name: string;
    legal_name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    tax_id?: string | null;
    phone?: string | null;
  };
  recipient: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    ssn_last_four?: string | null;
  };
  payments: {
    nonemployeeCompensation: number;
    federalTaxWithheld: number;
    stateTaxWithheld: number;
    stateIncome: number;
  };
  accountNumber?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, formData, ssnFull, ssnLastFour } = await req.json();
    console.log(`Generating ${type} PDF...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let pdfBytes: Uint8Array;

    if (type === "w9") {
      pdfBytes = await generateW9PDF(supabase, formData as W9FormData, ssnFull, ssnLastFour);
    } else if (type === "1099-nec") {
      pdfBytes = await generate1099PDF(supabase, formData as Generate1099Data);
    } else {
      throw new Error(`Unknown form type: ${type}`);
    }

    console.log(`PDF generated successfully, size: ${pdfBytes.length} bytes`);

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}-form.pdf"`,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error generating PDF:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function generateW9PDF(
  supabase: any,
  formData: W9FormData,
  ssnFull?: string | null,
  ssnLastFour?: string | null
): Promise<Uint8Array> {
  // Download template from storage
  const { data: templateData, error } = await supabase.storage
    .from("form-templates")
    .download("w9-fillable.pdf");

  if (error) {
    console.error("Error downloading template:", error);
    throw new Error(`Failed to download W-9 template: ${error.message}`);
  }

  const templateBytes = await templateData.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  // Get form fields
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  console.log("Available form fields:", fields.map(f => f.getName()));
  
  // Try to fill form fields - field names vary by PDF version
  // Common W-9 fillable PDF field patterns
  const fieldMappings: Record<string, string | undefined> = {
    // Various common field name patterns for W-9 forms
    "f1_1": formData.name_on_return,
    "f1_2": formData.business_name || undefined,
    "f1_5": formData.address || undefined,
    "f1_6": `${formData.city || ""}, ${formData.state || ""} ${formData.zip || ""}`.trim(),
    "f1_7": formData.account_numbers || undefined,
    // Line 1 - Name
    "topmostSubform[0].Page1[0].f1_1[0]": formData.name_on_return,
    "Line1[0]": formData.name_on_return,
    // Line 2 - Business name
    "topmostSubform[0].Page1[0].f1_2[0]": formData.business_name || undefined,
    "Line2[0]": formData.business_name || undefined,
    // Address
    "topmostSubform[0].Page1[0].f1_5[0]": formData.address || undefined,
    "topmostSubform[0].Page1[0].f1_6[0]": `${formData.city || ""}, ${formData.state || ""} ${formData.zip || ""}`.trim(),
    // Account numbers
    "topmostSubform[0].Page1[0].f1_7[0]": formData.account_numbers || undefined,
    // Exemptions
    "topmostSubform[0].Page1[0].f1_3[0]": formData.exempt_payee_code || undefined,
    "topmostSubform[0].Page1[0].f1_4[0]": formData.fatca_exemption_code || undefined,
  };

  // SSN fields
  if (ssnFull && ssnFull.length === 9) {
    const ssnPart1 = ssnFull.substring(0, 3);
    const ssnPart2 = ssnFull.substring(3, 5);
    const ssnPart3 = ssnFull.substring(5, 9);
    
    fieldMappings["f1_8"] = ssnPart1;
    fieldMappings["f1_9"] = ssnPart2;
    fieldMappings["f1_10"] = ssnPart3;
    fieldMappings["topmostSubform[0].Page1[0].f1_8[0]"] = ssnPart1;
    fieldMappings["topmostSubform[0].Page1[0].f1_9[0]"] = ssnPart2;
    fieldMappings["topmostSubform[0].Page1[0].f1_10[0]"] = ssnPart3;
  }

  // EIN fields
  if (formData.ein) {
    const einDigits = formData.ein.replace(/\D/g, "");
    if (einDigits.length >= 2) {
      const einPart1 = einDigits.substring(0, 2);
      const einPart2 = einDigits.substring(2);
      
      fieldMappings["f1_11"] = einPart1;
      fieldMappings["f1_12"] = einPart2;
      fieldMappings["topmostSubform[0].Page1[0].f1_11[0]"] = einPart1;
      fieldMappings["topmostSubform[0].Page1[0].f1_12[0]"] = einPart2;
    }
  }

  // Fill each field if it exists
  for (const [fieldName, value] of Object.entries(fieldMappings)) {
    if (value) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value);
      } catch (e) {
        // Field doesn't exist, skip
      }
    }
  }

  // Handle checkboxes for tax classification
  const classificationCheckboxes: Record<string, string[]> = {
    "individual": ["c1_1", "topmostSubform[0].Page1[0].c1_1[0]"],
    "c_corporation": ["c1_2", "topmostSubform[0].Page1[0].c1_2[0]"],
    "s_corporation": ["c1_3", "topmostSubform[0].Page1[0].c1_3[0]"],
    "partnership": ["c1_4", "topmostSubform[0].Page1[0].c1_4[0]"],
    "trust_estate": ["c1_5", "topmostSubform[0].Page1[0].c1_5[0]"],
    "llc": ["c1_6", "topmostSubform[0].Page1[0].c1_6[0]"],
    "other": ["c1_7", "topmostSubform[0].Page1[0].c1_7[0]"],
  };

  const classification = formData.federal_tax_classification?.toLowerCase() || "";
  for (const [classType, fieldNames] of Object.entries(classificationCheckboxes)) {
    if (classification.includes(classType)) {
      for (const fieldName of fieldNames) {
        try {
          const checkbox = form.getCheckBox(fieldName);
          checkbox.check();
        } catch (e) {
          // Checkbox doesn't exist, skip
        }
      }
    }
  }

  // Flatten the form to make fields non-editable
  form.flatten();
  
  return await pdfDoc.save();
}

async function generate1099PDF(
  supabase: any,
  formData: Generate1099Data
): Promise<Uint8Array> {
  // Download template from storage
  const { data: templateData, error } = await supabase.storage
    .from("form-templates")
    .download("1099-nec-fillable.pdf");

  if (error) {
    console.error("Error downloading template:", error);
    throw new Error(`Failed to download 1099-NEC template: ${error.message}`);
  }

  const templateBytes = await templateData.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  console.log("Available 1099 form fields:", fields.map(f => f.getName()));

  // Format currency
  const formatAmount = (amount: number): string => {
    return amount.toFixed(2);
  };

  // Format SSN for display (masked)
  const formatSSN = (lastFour?: string | null): string => {
    if (!lastFour) return "";
    return `***-**-${lastFour}`;
  };

  // Common 1099-NEC field mappings
  const fieldMappings: Record<string, string | undefined> = {
    // Payer info
    "f1_1": formData.company.legal_name || formData.company.company_name,
    "f1_2": formData.company.address || undefined,
    "f1_3": `${formData.company.city || ""}, ${formData.company.state || ""} ${formData.company.zip || ""}`.trim(),
    "f1_4": formData.company.phone || undefined,
    // Payer TIN
    "f1_5": formData.company.tax_id || undefined,
    // Recipient TIN
    "f1_6": formatSSN(formData.recipient.ssn_last_four),
    // Recipient name
    "f1_7": formData.recipient.name,
    // Recipient address
    "f1_8": formData.recipient.address || undefined,
    "f1_9": `${formData.recipient.city || ""}, ${formData.recipient.state || ""} ${formData.recipient.zip || ""}`.trim(),
    // Account number
    "f1_10": formData.accountNumber || undefined,
    // Box 1 - Nonemployee compensation
    "f1_11": formatAmount(formData.payments.nonemployeeCompensation),
    // Box 4 - Federal income tax withheld
    "f1_14": formatAmount(formData.payments.federalTaxWithheld),
    // Box 5 - State tax withheld
    "f1_15": formatAmount(formData.payments.stateTaxWithheld),
    // Box 6 - State/Payer's state no.
    "f1_16": formData.company.state || undefined,
    // Box 7 - State income
    "f1_17": formatAmount(formData.payments.stateIncome),
    // Alternative field name patterns
    "topmostSubform[0].CopyA[0].f1_1[0]": formData.company.legal_name || formData.company.company_name,
    "topmostSubform[0].CopyA[0].f1_7[0]": formData.recipient.name,
    "topmostSubform[0].CopyA[0].f1_11[0]": formatAmount(formData.payments.nonemployeeCompensation),
  };

  // Fill each field if it exists
  for (const [fieldName, value] of Object.entries(fieldMappings)) {
    if (value) {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value);
      } catch (e) {
        // Field doesn't exist, skip
      }
    }
  }

  // Flatten the form
  form.flatten();
  
  return await pdfDoc.save();
}
