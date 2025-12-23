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
    ssn_full?: string | null;
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
  
  console.log("Form data received:", JSON.stringify(formData, null, 2));
  
  // Exact field mappings based on the uploaded W-9 PDF template
  const cityStateZip = `${formData.city || ""}, ${formData.state || ""} ${formData.zip || ""}`.trim();
  
  const fieldMappings: Record<string, string | undefined> = {
    // Line 1 - Name
    "topmostSubform[0].Page1[0].f1_01[0]": formData.name_on_return,
    // Line 2 - Business name/disregarded entity name
    "topmostSubform[0].Page1[0].f1_02[0]": formData.business_name || undefined,
    // LLC Tax Classification (Line 3b)
    "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]": formData.llc_tax_classification || undefined,
    // Other classification description
    "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_04[0]": formData.other_classification || undefined,
    // Exempt payee code (Line 4)
    "topmostSubform[0].Page1[0].f1_05[0]": formData.exempt_payee_code || undefined,
    // FATCA exemption code (Line 4)
    "topmostSubform[0].Page1[0].f1_06[0]": formData.fatca_exemption_code || undefined,
    // Address (Line 5)
    "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]": formData.address || undefined,
    // City, State, ZIP (Line 6)
    "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]": cityStateZip || undefined,
    // Account numbers (Line 7)
    "topmostSubform[0].Page1[0].f1_09[0]": formData.account_numbers || undefined,
    // Signature date
    "topmostSubform[0].Page1[0].f1_15[0]": formData.signature_date || undefined,
  };

  // SSN fields (Part I - f1_10, f1_11, f1_12)
  if (ssnFull && ssnFull.length === 9) {
    const ssnPart1 = ssnFull.substring(0, 3);  // XXX
    const ssnPart2 = ssnFull.substring(3, 5);  // XX
    const ssnPart3 = ssnFull.substring(5, 9);  // XXXX
    
    fieldMappings["topmostSubform[0].Page1[0].f1_10[0]"] = ssnPart1;
    fieldMappings["topmostSubform[0].Page1[0].f1_11[0]"] = ssnPart2;
    fieldMappings["topmostSubform[0].Page1[0].f1_12[0]"] = ssnPart3;
    console.log(`SSN filled: ${ssnPart1}-${ssnPart2}-${ssnPart3}`);
  }

  // EIN fields (Part I - f1_13, f1_14)
  if (formData.ein) {
    const einDigits = formData.ein.replace(/\D/g, "");
    if (einDigits.length >= 2) {
      const einPart1 = einDigits.substring(0, 2);      // XX
      const einPart2 = einDigits.substring(2);         // XXXXXXX
      
      fieldMappings["topmostSubform[0].Page1[0].f1_13[0]"] = einPart1;
      fieldMappings["topmostSubform[0].Page1[0].f1_14[0]"] = einPart2;
      console.log(`EIN filled: ${einPart1}-${einPart2}`);
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

  // Handle checkboxes for tax classification (Line 3a)
  // Checkbox order in PDF: c1_1[0]=Individual, c1_1[1]=C Corp, c1_1[2]=S Corp, 
  // c1_1[3]=Partnership, c1_1[4]=Trust/Estate, c1_1[5]=LLC, c1_1[6]=Other
  const classificationToCheckbox: Record<string, string> = {
    "individual": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]",
    "sole_proprietor": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]",
    "c_corporation": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]",
    "s_corporation": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[2]",
    "partnership": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[3]",
    "trust_estate": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[4]",
    "trust": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[4]",
    "estate": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[4]",
    "llc": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]",
    "limited_liability": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]",
    "other": "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[6]",
  };

  const classification = formData.federal_tax_classification?.toLowerCase().replace(/[\s\/]+/g, "_") || "";
  console.log(`Tax classification: ${formData.federal_tax_classification} -> normalized: ${classification}`);
  
  for (const [classType, fieldName] of Object.entries(classificationToCheckbox)) {
    if (classification.includes(classType)) {
      try {
        const checkbox = form.getCheckBox(fieldName);
        checkbox.check();
        console.log(`Checked checkbox: ${fieldName}`);
        break; // Only check one
      } catch (e) {
        console.log(`Could not check ${fieldName}: ${e}`);
      }
    }
  }

  // Handle foreign partners checkbox (c1_2[0])
  if (formData.has_foreign_partners) {
    try {
      const foreignCheckbox = form.getCheckBox("topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_2[0]");
      foreignCheckbox.check();
      console.log("Checked foreign partners checkbox");
    } catch (e) {
      console.log(`Could not check foreign partners checkbox: ${e}`);
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

  // Format SSN for display - use full SSN if available, otherwise mask with last 4
  const formatSSN = (ssnFull?: string | null, lastFour?: string | null): string => {
    if (ssnFull) {
      const digits = ssnFull.replace(/\D/g, "");
      if (digits.length === 9) {
        return `${digits.substring(0, 3)}-${digits.substring(3, 5)}-${digits.substring(5, 9)}`;
      }
      return ssnFull;
    }
    if (lastFour) {
      return `***-**-${lastFour}`;
    }
    return "";
  };

  // Build payer info
  const payerName = formData.company.legal_name || formData.company.company_name;
  const payerAddress = formData.company.address || "";
  const payerCityStateZip = `${formData.company.city || ""}, ${formData.company.state || ""} ${formData.company.zip || ""}`.trim();
  const payerTIN = formData.company.tax_id || "";
  
  // Build recipient info
  const recipientName = formData.recipient.name;
  const recipientAddress = formData.recipient.address || "";
  const recipientCityStateZip = `${formData.recipient.city || ""}, ${formData.recipient.state || ""} ${formData.recipient.zip || ""}`.trim();
  const recipientTIN = formatSSN(formData.recipient.ssn_full, formData.recipient.ssn_last_four);
  
  // Payment amounts
  const nonemployeeComp = formatAmount(formData.payments.nonemployeeCompensation);
  const federalWithheld = formatAmount(formData.payments.federalTaxWithheld);
  const stateTaxWithheld = formatAmount(formData.payments.stateTaxWithheld);
  const stateIncome = formatAmount(formData.payments.stateIncome);
  const taxYear = formData.taxYear.toString();

  console.log("Filling 1099 with data:", {
    payerName, recipientName, recipientTIN, nonemployeeComp, taxYear
  });

  // 1099-NEC has multiple copies - fill all of them based on the actual PDF field structure
  // Field names from the logs: CopyA, Copy1, CopyB, Copy2
  const copies = [
    { prefix: "topmostSubform[0].CopyA[0]", yearField: "PgHeader[0].CalendarYear[0].f1_1[0]", leftCol: "LeftCol[0]", rightCol: "RightCol[0]", fPrefix: "f1_" },
    { prefix: "topmostSubform[0].Copy1[0]", yearField: "PgHeader[0].CalendarYear[0].f2_1[0]", leftCol: "LeftCol[0]", rightCol: "RightCol[0]", fPrefix: "f2_" },
    { prefix: "topmostSubform[0].CopyB[0]", yearField: "PgHeader[0].CalendarYear[0].f2_1[0]", leftCol: "LeftCol[0]", rightCol: "RightCol[0]", fPrefix: "f2_" },
    { prefix: "topmostSubform[0].Copy2[0]", yearField: "PgHeader[0].CalendarYear[0].f2_1[0]", leftCol: "LeftCol[0]", rightCol: "RightCol[0]", fPrefix: "f2_" },
  ];

  for (const copy of copies) {
    // Based on actual logged field names:
    // f1_2 = Payer name, f1_3 = Payer address, f1_4 = Payer city/state/zip
    // f1_5 = Payer TIN, f1_6 = Recipient TIN, f1_7 = Recipient name
    // f1_8 = Recipient address + city/state/zip combined
    // f1_9 = Nonemployee compensation (Box 1)
    const fieldMappings: Record<string, string> = {};
    
    // Calendar year
    fieldMappings[`${copy.prefix}.${copy.yearField}`] = taxYear;
    
    // Left column - Payer and Recipient info
    fieldMappings[`${copy.prefix}.${copy.leftCol}.${copy.fPrefix}2[0]`] = payerName;
    fieldMappings[`${copy.prefix}.${copy.leftCol}.${copy.fPrefix}3[0]`] = payerAddress;
    fieldMappings[`${copy.prefix}.${copy.leftCol}.${copy.fPrefix}4[0]`] = payerCityStateZip;
    fieldMappings[`${copy.prefix}.${copy.leftCol}.${copy.fPrefix}5[0]`] = payerTIN;
    fieldMappings[`${copy.prefix}.${copy.leftCol}.${copy.fPrefix}6[0]`] = recipientTIN;
    fieldMappings[`${copy.prefix}.${copy.leftCol}.${copy.fPrefix}7[0]`] = recipientName;
    fieldMappings[`${copy.prefix}.${copy.leftCol}.${copy.fPrefix}8[0]`] = `${recipientAddress}\n${recipientCityStateZip}`;
    
    // Right column - Payment amounts
    // Box 1 - Nonemployee compensation
    fieldMappings[`${copy.prefix}.${copy.rightCol}.${copy.fPrefix}9[0]`] = nonemployeeComp;
    // Box 4 - Federal income tax withheld
    fieldMappings[`${copy.prefix}.${copy.rightCol}.${copy.fPrefix}10[0]`] = federalWithheld;
    // Box 5 - State tax withheld (in Box5_ReadOrder)
    fieldMappings[`${copy.prefix}.${copy.rightCol}.Box5_ReadOrder[0].${copy.fPrefix}12[0]`] = stateTaxWithheld;
    // Box 6 - State/Payer's state no (in Box6_ReadOrder)
    fieldMappings[`${copy.prefix}.${copy.rightCol}.Box6_ReadOrder[0].${copy.fPrefix}14[0]`] = formData.company.state || "";
    // Box 7 - State income (in Box7_ReadOrder)
    fieldMappings[`${copy.prefix}.${copy.rightCol}.Box7_ReadOrder[0].${copy.fPrefix}16[0]`] = stateIncome;

    // Fill each field
    for (const [fieldName, value] of Object.entries(fieldMappings)) {
      if (value) {
        try {
          const field = form.getTextField(fieldName);
          field.setText(value);
          console.log(`Filled ${fieldName} = ${value.substring(0, 30)}...`);
        } catch (e) {
          // Field doesn't exist, try without the nested structure
        }
      }
    }
  }

  // Flatten the form
  form.flatten();
  
  return await pdfDoc.save();
}
