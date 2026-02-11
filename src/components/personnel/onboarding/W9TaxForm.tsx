import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/form-builder/SignaturePad";
import { cn } from "@/lib/utils";

interface W9TaxFormProps {
  data: {
    tax_classification: string;
    tax_ein: string;
    tax_business_name: string;
    w9_signature: string | null;
    w9_certification: boolean;
  };
  onChange: (field: string, value: string | boolean | null) => void;
  personnelData: {
    first_name: string;
    last_name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    ssn_full: string;
  };
}

const TAX_CLASSIFICATIONS = [
  { value: "individual", label: "Individual/sole proprietor or single-member LLC" },
  { value: "c_corporation", label: "C corporation" },
  { value: "s_corporation", label: "S corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust/estate" },
];

export function W9TaxForm({ data, onChange, personnelData }: W9TaxFormProps) {
  const fullName = `${personnelData.first_name} ${personnelData.last_name}`;
  const needsEIN = data.tax_classification && !["individual"].includes(data.tax_classification);

  // Parse SSN into parts for display
  const ssnParts = {
    part1: personnelData.ssn_full?.slice(0, 3) || "",
    part2: personnelData.ssn_full?.slice(3, 5) || "",
    part3: personnelData.ssn_full?.slice(5, 9) || "",
  };

  // Parse EIN into parts
  const einParts = {
    part1: data.tax_ein?.replace("-", "").slice(0, 2) || "",
    part2: data.tax_ein?.replace("-", "").slice(2, 9) || "",
  };

  const isLLC = data.tax_classification?.startsWith("llc_");
  const llcClassification = isLLC ? data.tax_classification.split("_")[1]?.toUpperCase() : "";

  return (
    <div className="w9-form-container">
      {/* Styles */}
      <style>{`
        /* Force dark text colors throughout the form - override theme */
        .w9-form-container,
        .w9-form-container * {
          color: #000 !important;
        }

        .w9-form-container {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10pt;
          line-height: 1.2;
          max-width: 8.5in;
          margin: 0 auto;
        }

        .w9-page {
          background: white !important;
          border: 1px solid #ccc;
          border-radius: 8px;
          overflow: hidden;
          color: #000 !important;
        }

        .w9-header {
          display: flex;
          border-bottom: 2pt solid black;
          padding: 8px;
          background: white !important;
        }

        .w9-header-left {
          width: 18%;
        }

        .w9-form-number {
          font-size: 28pt;
          font-weight: bold;
          line-height: 1;
          color: #000 !important;
        }

        .w9-form-rev {
          font-size: 7.5pt;
          margin-top: 2px;
          color: #000 !important;
        }

        .w9-form-dept {
          font-size: 7.5pt;
          margin-top: 4px;
          line-height: 1.1;
          color: #000 !important;
        }

        .w9-header-center {
          flex: 1;
          text-align: center;
          padding: 0 10px;
        }

        .w9-main-title {
          font-size: 13pt;
          font-weight: bold;
          line-height: 1.15;
          color: #000 !important;
        }

        .w9-center-url {
          font-size: 7.5pt;
          margin-top: 3px;
          color: #000 !important;
        }

        .w9-header-right {
          width: 26%;
          text-align: right;
          font-size: 8pt;
          font-weight: bold;
          line-height: 1.2;
          color: #000 !important;
        }

        .w9-instruction-box {
          border: 1pt solid black;
          background: #f5f5f5 !important;
          padding: 6px 8px;
          font-size: 7.5pt;
          margin: 8px;
          line-height: 1.3;
          color: #000 !important;
        }

        .w9-form-body {
          border: 1pt solid black;
          margin: 0 8px 8px 8px;
          background: white !important;
        }

        .w9-form-row {
          border-bottom: 1pt solid black;
          padding: 6px 8px;
          min-height: 36px;
          background: white !important;
        }

        .w9-form-row:last-child {
          border-bottom: none;
        }

        .w9-row-number {
          font-weight: bold;
          font-size: 9pt;
          margin-right: 4px;
          color: #000 !important;
        }

        .w9-row-label {
          font-size: 7.5pt;
          line-height: 1.3;
          color: #000 !important;
        }

        .w9-input-field {
          border: none !important;
          outline: none;
          width: 100%;
          font-size: 11pt;
          font-family: Arial, Helvetica, sans-serif;
          background: transparent !important;
          margin-top: 4px;
          padding: 2px 0;
          box-shadow: none !important;
          color: #000 !important;
        }

        .w9-split-section {
          display: flex;
          border-bottom: 1pt solid black;
        }

        .w9-left-section {
          flex: 0 0 65%;
          padding: 8px;
          border-right: 1pt solid black;
        }

        .w9-right-section {
          flex: 0 0 35%;
          padding: 8px;
        }

        .w9-checkbox-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
          margin: 6px 0;
        }

        .w9-checkbox-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .w9-checkbox-item input[type="radio"] {
          width: 12px;
          height: 12px;
          margin: 0;
          accent-color: black;
        }

        .w9-checkbox-item label {
          font-size: 8pt;
          cursor: pointer;
        }

        .w9-llc-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 6px;
        }

        .w9-llc-input {
          width: 24px;
          height: 20px;
          border: 1pt solid black !important;
          text-align: center;
          font-size: 10pt;
          text-transform: uppercase;
          padding: 0;
        }

        .w9-note-box {
          font-size: 7pt;
          line-height: 1.25;
          margin: 6px 0;
          color: #000 !important;
        }

        .w9-address-section {
          display: flex;
          border-bottom: 1pt solid black;
        }

        .w9-addr-left {
          flex: 0 0 55%;
          padding: 6px 8px;
          border-right: 1pt solid black;
        }

        .w9-addr-right {
          flex: 0 0 45%;
          padding: 6px 8px;
        }

        .w9-part-header {
          background: black;
          color: white;
          padding: 4px 8px;
          font-weight: bold;
          font-size: 9pt;
          margin: 8px 8px 0 8px;
        }

        .w9-tin-section {
          border: 1pt solid black;
          padding: 8px;
          margin: 0 8px;
          font-size: 7.5pt;
          line-height: 1.35;
        }

        .w9-tin-grid {
          display: flex;
          margin-top: 12px;
        }

        .w9-tin-left {
          flex: 0 0 55%;
          padding-right: 16px;
        }

        .w9-tin-right {
          flex: 0 0 45%;
          border-left: 1pt solid black;
          padding-left: 16px;
        }

        .w9-tin-label {
          font-size: 8pt;
          font-weight: bold;
          margin-bottom: 6px;
        }

        .w9-tin-inputs {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 6px;
        }

        .w9-tin-box {
          border: 1pt solid black;
          padding: 6px 4px;
          text-align: center;
          font-size: 12pt;
          font-family: 'Courier New', Courier, monospace;
          background: white;
          min-width: 20px;
        }

        .w9-tin-box.ssn-1 { width: 50px; }
        .w9-tin-box.ssn-2 { width: 36px; }
        .w9-tin-box.ssn-3 { width: 56px; }
        .w9-tin-box.ein-1 { width: 36px; }
        .w9-tin-box.ein-2 { width: 100px; }

        .w9-or-text {
          text-align: center;
          font-weight: bold;
          font-size: 10pt;
          margin: 8px 0;
        }

        .w9-cert-section {
          border: 1pt solid black;
          padding: 8px;
          margin: 0 8px 8px 8px;
          font-size: 7.5pt;
          line-height: 1.4;
        }

        .w9-cert-section ol {
          margin: 6px 0 6px 20px;
          padding: 0;
        }

        .w9-cert-section li {
          margin-bottom: 4px;
        }

        .w9-cert-instructions {
          margin-top: 8px;
          font-size: 7pt;
          line-height: 1.35;
          color: #000 !important;
        }

        .w9-signature-area {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1pt solid black;
        }

        .w9-sig-label {
          font-weight: bold;
          font-size: 9pt;
          white-space: nowrap;
        }

        .w9-sig-input {
          flex: 1;
        }

        .w9-sig-date {
          width: 150px;
        }

        .w9-small-label {
          font-size: 7pt;
          color: #000 !important;
          margin-bottom: 4px;
        }

        .w9-certification-check {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 12px 0;
          padding: 8px;
          background: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        @media screen and (max-width: 768px) {
          .w9-header {
            flex-direction: column;
            text-align: center;
          }

          .w9-header-left,
          .w9-header-right {
            width: 100%;
            text-align: center;
            margin-bottom: 8px;
          }

          .w9-split-section,
          .w9-address-section {
            flex-direction: column;
          }

          .w9-left-section,
          .w9-right-section,
          .w9-addr-left,
          .w9-addr-right {
            flex: none;
            width: 100%;
            border-right: none;
            border-bottom: 1pt solid black;
          }

          .w9-right-section:last-child,
          .w9-addr-right:last-child {
            border-bottom: none;
          }

          .w9-tin-grid {
            flex-direction: column;
          }

          .w9-tin-left,
          .w9-tin-right {
            flex: none;
            width: 100%;
            padding: 0;
            border: none;
            margin-bottom: 16px;
          }

          .w9-tin-right {
            padding-top: 16px;
            border-top: 1pt solid #ccc;
          }

          .w9-signature-area {
            flex-direction: column;
            align-items: stretch;
          }

          .w9-sig-date {
            width: 100%;
          }

          .w9-checkbox-row {
            flex-direction: column;
            gap: 8px;
          }
        }
      `}</style>

      <div className="w9-page">
        {/* Header */}
        <div className="w9-header">
          <div className="w9-header-left">
            <div className="w9-form-number">W-9</div>
            <div className="w9-form-rev">(Rev. March 2024)</div>
            <div className="w9-form-dept">
              Department of the Treasury<br />
              Internal Revenue Service
            </div>
          </div>
          <div className="w9-header-center">
            <div className="w9-main-title">
              Request for Taxpayer<br />
              Identification Number and Certification
            </div>
            <div className="w9-center-url">
              ▶ Go to www.irs.gov/FormW9 for instructions and the latest information.
            </div>
          </div>
          <div className="w9-header-right">
            Give form to the<br />
            requester. Do not<br />
            send to the IRS.
          </div>
        </div>

        {/* Instruction Box */}
        <div className="w9-instruction-box">
          <strong>Before you begin.</strong> For guidance related to the purpose of Form W-9, see Purpose of Form, below.
        </div>

        {/* Form Body */}
        <div className="w9-form-body">
          {/* Line 1 - Name */}
          <div className="w9-form-row">
            <span className="w9-row-number">1</span>
            <span className="w9-row-label">
              Name of entity/individual. An entry is required. (For a sole proprietor or disregarded entity, enter the owner's name on line 1, and enter the business/disregarded entity's name on line 2.)
            </span>
            <input
              type="text"
              className="w9-input-field"
              value={fullName}
              readOnly
              style={{ fontWeight: "bold" }}
            />
          </div>

          {/* Line 2 - Business Name */}
          <div className="w9-form-row">
            <span className="w9-row-number">2</span>
            <span className="w9-row-label">
              Business name/disregarded entity name, if different from above.
            </span>
            <Input
              className="w9-input-field"
              value={data.tax_business_name}
              onChange={(e) => onChange("tax_business_name", e.target.value)}
              placeholder="Enter business name (if applicable)"
            />
          </div>

          {/* Line 3a and 4 - Split Section */}
          <div className="w9-split-section">
            <div className="w9-left-section">
              <span className="w9-row-number">3a</span>
              <span className="w9-row-label">
                Check the appropriate box for federal tax classification of the entity/individual whose name is entered on line 1. Check only one of the following seven boxes.
              </span>

              <div className="w9-checkbox-row">
                {TAX_CLASSIFICATIONS.map((option) => (
                  <div key={option.value} className="w9-checkbox-item">
                    <input
                      type="radio"
                      id={option.value}
                      name="tax_classification"
                      checked={data.tax_classification === option.value}
                      onChange={() => onChange("tax_classification", option.value)}
                    />
                    <label htmlFor={option.value}>{option.label}</label>
                  </div>
                ))}
              </div>

              <div className="w9-llc-row">
                <input
                  type="radio"
                  id="llc"
                  name="tax_classification"
                  checked={isLLC}
                  onChange={() => onChange("tax_classification", "llc_c")}
                />
                <label htmlFor="llc" style={{ fontSize: "8pt" }}>
                  LLC. Enter the tax classification (C = C corporation, S = S corporation, P = Partnership)
                </label>
                <span style={{ marginLeft: "4px" }}>▶</span>
                <input
                  type="text"
                  className="w9-llc-input"
                  maxLength={1}
                  value={llcClassification}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    if (val === "C") onChange("tax_classification", "llc_c");
                    else if (val === "S") onChange("tax_classification", "llc_s");
                    else if (val === "P") onChange("tax_classification", "llc_p");
                  }}
                  disabled={!isLLC}
                />
              </div>

              <div className="w9-note-box">
                <strong>Note:</strong> Check the "LLC" box above and, in the entry space, enter the appropriate code (C, S, or P) for the tax classification of the LLC, unless it is a disregarded entity. A disregarded entity should instead check the appropriate box for the tax classification of its owner.
              </div>
            </div>

            <div className="w9-right-section">
              <span className="w9-row-number">4</span>
              <span className="w9-row-label">
                Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):
              </span>
              <div style={{ marginTop: "8px" }}>
                <div className="w9-small-label">Exempt payee code (if any)</div>
                <Input
                  className="w9-input-field"
                  style={{ maxWidth: "60px", border: "1pt solid black", padding: "4px" }}
                  maxLength={2}
                />
              </div>
              <div style={{ marginTop: "8px" }}>
                <div className="w9-small-label">Exemption from FATCA reporting code (if any)</div>
                <Input
                  className="w9-input-field"
                  style={{ maxWidth: "60px", border: "1pt solid black", padding: "4px" }}
                  maxLength={2}
                />
              </div>
              <div className="w9-note-box">
                (Applies to accounts maintained outside the United States.)
              </div>
            </div>
          </div>

          {/* Lines 5-6 - Address */}
          <div className="w9-address-section">
            <div className="w9-addr-left">
              <span className="w9-row-number">5</span>
              <span className="w9-row-label">Address (number, street, and apt. or suite no.). See instructions.</span>
              <input
                type="text"
                className="w9-input-field"
                value={personnelData.address}
                readOnly
              />
            </div>
            <div className="w9-addr-right">
              <span className="w9-row-label">Requester's name and address (optional)</span>
              <input
                type="text"
                className="w9-input-field"
                readOnly
                style={{ borderBottom: "1pt solid #ccc" }}
              />
            </div>
          </div>

          <div className="w9-address-section">
            <div className="w9-addr-left">
              <span className="w9-row-number">6</span>
              <span className="w9-row-label">City, state, and ZIP code</span>
              <input
                type="text"
                className="w9-input-field"
                value={[personnelData.city, personnelData.state, personnelData.zip].filter(Boolean).join(", ")}
                readOnly
              />
            </div>
            <div className="w9-addr-right">
              <input
                type="text"
                className="w9-input-field"
                readOnly
                style={{ borderBottom: "1pt solid #ccc" }}
              />
            </div>
          </div>

          {/* Line 7 - Account Numbers */}
          <div className="w9-form-row">
            <span className="w9-row-number">7</span>
            <span className="w9-row-label">List account number(s) here (optional)</span>
            <input
              type="text"
              className="w9-input-field"
            />
          </div>
        </div>

        {/* Part I - TIN */}
        <div className="w9-part-header">Part I&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Taxpayer Identification Number (TIN)</div>
        <div className="w9-tin-section">
          <p>
            Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid backup withholding. For individuals, this is generally your social security number (SSN). However, for a resident alien, sole proprietor, or disregarded entity, see the instructions for Part I, later. For other entities, it is your employer identification number (EIN). If you do not have a number, see How to get a TIN, later.
          </p>
          <p style={{ marginTop: "6px" }}>
            <strong>Note:</strong> If the account is in more than one name, see the instructions for line 1. See also What Name and Number To Give the Requester for guidelines on whose number to enter.
          </p>

          <div className="w9-tin-grid">
            <div className="w9-tin-left">
              <div className="w9-tin-label">Social security number</div>
              <div className="w9-tin-inputs">
                <Input
                  className={cn("w9-tin-box ssn-1", needsEIN && "opacity-50")}
                  value={ssnParts.part1}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                    const full = val + ssnParts.part2 + ssnParts.part3;
                    onChange("ssn_full", full);
                    if (val.length === 3) {
                      const next = e.target.closest(".w9-tin-inputs")?.querySelector<HTMLInputElement>(".ssn-2 input, input.ssn-2-input");
                      if (next) next.focus();
                    }
                  }}
                  maxLength={3}
                  disabled={needsEIN}
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                />
                <span>–</span>
                <Input
                  className={cn("w9-tin-box ssn-2", needsEIN && "opacity-50")}
                  value={ssnParts.part2}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                    const full = ssnParts.part1 + val + ssnParts.part3;
                    onChange("ssn_full", full);
                    if (val.length === 2) {
                      const next = e.target.closest(".w9-tin-inputs")?.querySelector<HTMLInputElement>(".ssn-3 input, input.ssn-3-input");
                      if (next) next.focus();
                    }
                  }}
                  maxLength={2}
                  disabled={needsEIN}
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                />
                <span>–</span>
                <Input
                  className={cn("w9-tin-box ssn-3", needsEIN && "opacity-50")}
                  value={ssnParts.part3}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    const full = ssnParts.part1 + ssnParts.part2 + val;
                    onChange("ssn_full", full);
                  }}
                  maxLength={4}
                  disabled={needsEIN}
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                />
              </div>
            </div>
            <div className="w9-tin-right">
              <div className="w9-or-text">or</div>
              <div className="w9-tin-label">Employer identification number</div>
              <div className="w9-tin-inputs">
                <Input
                  className={cn("w9-tin-box ein-1", !needsEIN && "opacity-50")}
                  value={einParts.part1}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
                    onChange("tax_ein", val + einParts.part2);
                  }}
                  maxLength={2}
                  disabled={!needsEIN}
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                />
                <span>–</span>
                <Input
                  className={cn("w9-tin-box ein-2", !needsEIN && "opacity-50")}
                  value={einParts.part2}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 7);
                    onChange("tax_ein", einParts.part1 + val);
                  }}
                  maxLength={7}
                  disabled={!needsEIN}
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Part II - Certification */}
        <div className="w9-part-header">Part II&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Certification</div>
        <div className="w9-cert-section">
          <p><strong>Under penalties of perjury, I certify that:</strong></p>
          <ol>
            <li>The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and</li>
            <li>I am not subject to backup withholding because (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and</li>
            <li>I am a U.S. citizen or other U.S. person (defined below); and</li>
            <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
          </ol>

          <div className="w9-cert-instructions">
            <strong>Certification instructions.</strong> You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return. For real estate transactions, item 2 does not apply. For mortgage interest paid, acquisition or abandonment of secured property, cancellation of debt, contributions to an individual retirement arrangement (IRA), and, generally, payments other than interest and dividends, you are not required to sign the certification, but you must provide your correct TIN. See the instructions for Part II, later.
          </div>

          <div className="w9-certification-check">
            <Checkbox
              id="w9_certification"
              checked={data.w9_certification}
              onCheckedChange={(checked) => onChange("w9_certification", checked === true)}
            />
            <label htmlFor="w9_certification" className="text-sm leading-normal cursor-pointer">
              I certify, under penalties of perjury, that the information provided is true, correct, and complete. *
            </label>
          </div>

          <div className="w9-signature-area">
            <div className="w9-sig-label">
              Sign<br />Here
            </div>
            <div className="w9-sig-input">
              <div className="w9-small-label">Signature of U.S. person ▶</div>
              <SignaturePad
                value={data.w9_signature || undefined}
                onChange={(sig) => onChange("w9_signature", sig)}
                required
              />
            </div>
            <div className="w9-sig-date">
              <div className="w9-small-label">Date ▶</div>
              <input
                type="text"
                className="w9-input-field"
                value={new Date().toLocaleDateString()}
                readOnly
                style={{ borderBottom: "1pt solid black", textAlign: "center" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
