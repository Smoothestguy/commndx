import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type PersonnelInsert = Database["public"]["Tables"]["personnel"]["Insert"];

export interface ParsedPersonnelRow extends Partial<PersonnelInsert> {
  rowNumber: number;
  errors: string[];
}

export interface ValidationResult {
  valid: ParsedPersonnelRow[];
  invalid: ParsedPersonnelRow[];
  totalRows: number;
}

const personnelRowSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  date_of_birth: z.string().optional(),
  hourly_rate: z.string().optional(),
  status: z.enum(["active", "inactive", "do_not_hire"]).optional(),
  ssn_last_four: z.string().max(4, "SSN last 4 must be 4 digits").optional(),
  work_authorization_type: z.enum(["citizen", "permanent_resident", "work_visa", "ead", "other"]).optional(),
  work_auth_expiry: z.string().optional(),
  everify_status: z.enum(["pending", "verified", "rejected", "expired", "not_required"]).optional(),
  everify_case_number: z.string().optional(),
  notes: z.string().optional(),
});

export const parseCSVFile = async (file: File): Promise<string[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const rows = lines.map(line => {
        // Handle quoted fields with commas
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        return line.split(regex).map(field => 
          field.trim().replace(/^"|"$/g, '')
        );
      });
      resolve(rows);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};

export const validatePersonnelRows = (
  rows: string[][],
  existingEmails: string[]
): ValidationResult => {
  if (rows.length === 0) {
    return { valid: [], invalid: [], totalRows: 0 };
  }

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);
  
  const valid: ParsedPersonnelRow[] = [];
  const invalid: ParsedPersonnelRow[] = [];
  const seenEmails = new Set<string>();

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 for header row and 0-index
    const rowData: any = {};
    const errors: string[] = [];

    // Map CSV columns to object
    headers.forEach((header, i) => {
      const value = row[i]?.trim();
      if (value) {
        rowData[header] = value;
      }
    });

    // Validate with schema
    try {
      const validated = personnelRowSchema.parse(rowData);
      
      // Additional validations
      const email = validated.email.toLowerCase();
      
      // Check for duplicates in file
      if (seenEmails.has(email)) {
        errors.push(`Duplicate email in file: ${email}`);
      }
      seenEmails.add(email);
      
      // Check against existing database records
      if (existingEmails.includes(email)) {
        errors.push(`Email already exists in database: ${email}`);
      }

      // Validate dates
      if (validated.date_of_birth) {
        const dob = new Date(validated.date_of_birth);
        if (isNaN(dob.getTime())) {
          errors.push("Invalid date_of_birth format (use YYYY-MM-DD)");
        }
      }

      if (validated.work_auth_expiry) {
        const expiry = new Date(validated.work_auth_expiry);
        if (isNaN(expiry.getTime())) {
          errors.push("Invalid work_auth_expiry format (use YYYY-MM-DD)");
        }
      }

      // Validate hourly_rate
      if (validated.hourly_rate) {
        const rate = parseFloat(validated.hourly_rate);
        if (isNaN(rate) || rate < 0) {
          errors.push("Invalid hourly_rate (must be a positive number)");
        }
      }

      const parsedRow: ParsedPersonnelRow = {
        rowNumber,
        first_name: validated.first_name,
        last_name: validated.last_name,
        email: validated.email,
        phone: validated.phone,
        address: validated.address,
        city: validated.city,
        state: validated.state,
        zip: validated.zip,
        date_of_birth: validated.date_of_birth,
        hourly_rate: validated.hourly_rate ? parseFloat(validated.hourly_rate) : undefined,
        status: validated.status as any,
        ssn_last_four: validated.ssn_last_four,
        work_authorization_type: validated.work_authorization_type as any,
        work_auth_expiry: validated.work_auth_expiry,
        everify_status: validated.everify_status as any,
        everify_case_number: validated.everify_case_number,
        notes: validated.notes,
        errors,
      };

      if (errors.length === 0) {
        valid.push(parsedRow);
      } else {
        invalid.push(parsedRow);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const zodErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        invalid.push({
          rowNumber,
          ...rowData,
          errors: zodErrors,
        });
      } else {
        invalid.push({
          rowNumber,
          ...rowData,
          errors: ["Failed to parse row"],
        });
      }
    }
  });

  return { valid, invalid, totalRows: dataRows.length };
};

export const generateSampleCSV = (): string => {
  const headers = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "zip",
    "date_of_birth",
    "hourly_rate",
    "status",
    "ssn_last_four",
    "work_authorization_type",
    "work_auth_expiry",
    "everify_status",
    "everify_case_number",
    "notes",
  ];

  const sampleRows = [
    [
      "John",
      "Smith",
      "john.smith@example.com",
      "555-123-4567",
      "123 Main St",
      "Austin",
      "TX",
      "78701",
      "1985-03-15",
      "25.00",
      "active",
      "1234",
      "citizen",
      "",
      "verified",
      "EV-2024-001",
      "Forklift certified",
    ],
    [
      "Jane",
      "Doe",
      "jane.doe@example.com",
      "555-987-6543",
      "456 Oak Ave",
      "Houston",
      "TX",
      "77001",
      "1990-07-22",
      "22.50",
      "active",
      "5678",
      "permanent_resident",
      "2025-12-31",
      "pending",
      "",
      "Bilingual",
    ],
  ];

  const csvContent = [
    headers.join(","),
    ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

export const downloadErrorReport = (invalidRows: ParsedPersonnelRow[]) => {
  const headers = ["Row", "Errors", "Data"];
  const rows = invalidRows.map(row => [
    row.rowNumber.toString(),
    row.errors.join("; "),
    JSON.stringify(row),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  downloadCSV(csvContent, `personnel-import-errors-${Date.now()}.csv`);
};
