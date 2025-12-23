import { PDFDocument } from 'pdf-lib';
import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";

export interface GenerateW9Options {
  w9Form: W9Form;
  ssnLastFour?: string | null;
  ssnFull?: string | null;
}

// Map database tax classification to form field checkbox names
const TAX_CLASSIFICATION_FIELDS: Record<string, string> = {
  'individual': 'c1_1[0]',
  'c_corporation': 'c1_1[1]',
  's_corporation': 'c1_1[2]',
  'partnership': 'c1_1[3]',
  'trust_estate': 'c1_1[4]',
  'llc': 'c1_1[5]',
  'other': 'c1_1[6]',
};

// Format SSN for display in form boxes
const formatSSNForBoxes = (ssnLastFour: string | null | undefined, ssnFull: string | null | undefined): { area: string; group: string; serial: string } => {
  if (ssnFull && ssnFull.length === 9) {
    return {
      area: ssnFull.substring(0, 3),
      group: ssnFull.substring(3, 5),
      serial: ssnFull.substring(5, 9),
    };
  }
  if (ssnLastFour) {
    return {
      area: '',
      group: '',
      serial: ssnLastFour,
    };
  }
  return { area: '', group: '', serial: '' };
};

// Format EIN for display in form boxes
const formatEINForBoxes = (ein: string | null | undefined): { prefix: string; suffix: string } => {
  if (!ein) return { prefix: '', suffix: '' };
  const digits = ein.replace(/\D/g, '');
  if (digits.length >= 2) {
    return {
      prefix: digits.substring(0, 2),
      suffix: digits.substring(2, 9),
    };
  }
  return { prefix: '', suffix: '' };
};

export async function generateW9(options: GenerateW9Options): Promise<Uint8Array> {
  const { w9Form, ssnLastFour, ssnFull } = options;

  // Fetch the fillable W-9 template
  const templateUrl = '/forms/w9-fillable.pdf';
  const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
  
  // Load the PDF
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  
  // Get all field names for debugging - you can uncomment this to see available fields
  // const fields = form.getFields();
  // console.log('W-9 Form fields:', fields.map(f => `${f.getName()} (${f.constructor.name})`));

  try {
    // Line 1 - Name
    const nameField = form.getTextField('f1_1[0]');
    if (nameField && w9Form.name_on_return) {
      nameField.setText(w9Form.name_on_return);
    }
  } catch (e) { console.warn('Field f1_1[0] not found'); }

  try {
    // Line 2 - Business name
    const businessNameField = form.getTextField('f1_2[0]');
    if (businessNameField && w9Form.business_name) {
      businessNameField.setText(w9Form.business_name);
    }
  } catch (e) { console.warn('Field f1_2[0] not found'); }

  // Line 3a - Tax classification checkboxes
  const taxClass = w9Form.federal_tax_classification?.toLowerCase();
  if (taxClass) {
    const checkboxFieldName = TAX_CLASSIFICATION_FIELDS[taxClass];
    if (checkboxFieldName) {
      try {
        const checkbox = form.getCheckBox(checkboxFieldName);
        if (checkbox) {
          checkbox.check();
        }
      } catch (e) { 
        // Try alternative field naming
        console.warn(`Checkbox ${checkboxFieldName} not found, trying alternatives`);
      }
    }
  }

  try {
    // LLC classification (C, S, or P)
    if (w9Form.llc_tax_classification) {
      const llcField = form.getTextField('f1_3[0]');
      if (llcField) {
        llcField.setText(w9Form.llc_tax_classification.toUpperCase());
      }
    }
  } catch (e) { console.warn('LLC field not found'); }

  try {
    // Other classification description
    if (w9Form.other_classification) {
      const otherField = form.getTextField('f1_4[0]');
      if (otherField) {
        otherField.setText(w9Form.other_classification);
      }
    }
  } catch (e) { console.warn('Other classification field not found'); }

  // Line 3b - Foreign partners checkbox
  if (w9Form.has_foreign_partners) {
    try {
      const foreignCheckbox = form.getCheckBox('c1_2[0]');
      if (foreignCheckbox) {
        foreignCheckbox.check();
      }
    } catch (e) { console.warn('Foreign partners checkbox not found'); }
  }

  try {
    // Line 4 - Exempt payee code
    if (w9Form.exempt_payee_code) {
      const exemptField = form.getTextField('f1_5[0]');
      if (exemptField) {
        exemptField.setText(w9Form.exempt_payee_code);
      }
    }
  } catch (e) { console.warn('Exempt payee code field not found'); }

  try {
    // Line 4 - FATCA exemption code
    if (w9Form.fatca_exemption_code) {
      const fatcaField = form.getTextField('f1_6[0]');
      if (fatcaField) {
        fatcaField.setText(w9Form.fatca_exemption_code);
      }
    }
  } catch (e) { console.warn('FATCA field not found'); }

  try {
    // Line 5 - Address
    if (w9Form.address) {
      const addressField = form.getTextField('f1_7[0]');
      if (addressField) {
        addressField.setText(w9Form.address);
      }
    }
  } catch (e) { console.warn('Address field not found'); }

  try {
    // Line 6 - City, State, ZIP
    const cityStateZip = [w9Form.city, w9Form.state, w9Form.zip].filter(Boolean).join(', ');
    if (cityStateZip) {
      const cityField = form.getTextField('f1_8[0]');
      if (cityField) {
        cityField.setText(cityStateZip);
      }
    }
  } catch (e) { console.warn('City/State/ZIP field not found'); }

  try {
    // Line 7 - Account numbers
    if (w9Form.account_numbers) {
      const accountField = form.getTextField('f1_9[0]');
      if (accountField) {
        accountField.setText(w9Form.account_numbers);
      }
    }
  } catch (e) { console.warn('Account numbers field not found'); }

  // Part I - TIN (SSN or EIN)
  // Try to fill SSN boxes
  const ssn = formatSSNForBoxes(ssnLastFour, ssnFull);
  if (ssn.area || ssn.serial) {
    try {
      // SSN field - first 3 digits
      const ssn1Field = form.getTextField('f1_10[0]');
      if (ssn1Field && ssn.area) {
        ssn1Field.setText(ssn.area);
      }
    } catch (e) { console.warn('SSN field 1 not found'); }
    
    try {
      // SSN field - middle 2 digits
      const ssn2Field = form.getTextField('f1_11[0]');
      if (ssn2Field && ssn.group) {
        ssn2Field.setText(ssn.group);
      }
    } catch (e) { console.warn('SSN field 2 not found'); }
    
    try {
      // SSN field - last 4 digits
      const ssn3Field = form.getTextField('f1_12[0]');
      if (ssn3Field && ssn.serial) {
        ssn3Field.setText(ssn.serial);
      }
    } catch (e) { console.warn('SSN field 3 not found'); }
  }

  // Try to fill EIN boxes
  if (w9Form.ein) {
    const ein = formatEINForBoxes(w9Form.ein);
    try {
      const ein1Field = form.getTextField('f1_13[0]');
      if (ein1Field && ein.prefix) {
        ein1Field.setText(ein.prefix);
      }
    } catch (e) { console.warn('EIN field 1 not found'); }
    
    try {
      const ein2Field = form.getTextField('f1_14[0]');
      if (ein2Field && ein.suffix) {
        ein2Field.setText(ein.suffix);
      }
    } catch (e) { console.warn('EIN field 2 not found'); }
  }

  // Signature date
  if (w9Form.signature_date) {
    try {
      const dateField = form.getTextField('f1_15[0]');
      if (dateField) {
        const date = new Date(w9Form.signature_date);
        dateField.setText(date.toLocaleDateString('en-US'));
      }
    } catch (e) { console.warn('Date field not found'); }
  }

  // Flatten the form to make it non-editable (optional)
  // form.flatten();

  // Save and return
  return await pdfDoc.save();
}

export async function downloadFormW9(options: GenerateW9Options): Promise<void> {
  const pdfBytes = await generateW9(options);
  const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  const name = options.w9Form.name_on_return?.replace(/\s+/g, '_') || 'form';
  link.download = `W-9_${name}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export async function getW9Blob(options: GenerateW9Options): Promise<Blob> {
  const pdfBytes = await generateW9(options);
  return new Blob([pdfBytes.slice()], { type: 'application/pdf' });
}
