import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { W9Form } from "@/integrations/supabase/hooks/useW9Forms";
import { downloadFormW9 } from "@/lib/generateW9";
import { toast } from "sonner";

interface W9FormPreviewProps {
  w9Form: W9Form;
  ssnLastFour?: string | null;
  ssnFull?: string | null;
}

export function W9FormPreview({ w9Form, ssnLastFour, ssnFull }: W9FormPreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadFormW9({
        w9Form,
        ssnLastFour: ssnLastFour || undefined,
        ssnFull: ssnFull || undefined,
      });
      toast.success("W-9 downloaded successfully");
    } catch (error) {
      console.error("Error downloading W-9:", error);
      toast.error("Failed to download W-9. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const formatSSN = () => {
    if (ssnFull) {
      const digits = ssnFull.replace(/\D/g, '');
      if (digits.length === 9) {
        return {
          ssn1: digits.slice(0, 3),
          ssn2: digits.slice(3, 5),
          ssn3: digits.slice(5, 9),
        };
      }
    }
    if (ssnLastFour) {
      return {
        ssn1: "XXX",
        ssn2: "XX",
        ssn3: ssnLastFour,
      };
    }
    return null;
  };

  const formatEIN = () => {
    if (w9Form.ein) {
      const digits = w9Form.ein.replace(/\D/g, '');
      if (digits.length >= 2) {
        return {
          ein1: digits.slice(0, 2),
          ein2: digits.slice(2),
        };
      }
    }
    return null;
  };

  const ssn = formatSSN();
  const ein = formatEIN();

  const getTaxClassificationChecks = () => {
    const classification = w9Form.federal_tax_classification?.toLowerCase() || "";
    return {
      individual: classification.includes("individual") || classification.includes("sole"),
      cCorp: classification.includes("c_corporation") || classification === "c corporation",
      sCorp: classification.includes("s_corporation") || classification === "s corporation",
      partnership: classification.includes("partnership"),
      trustEstate: classification.includes("trust") || classification.includes("estate"),
      llc: classification.includes("llc"),
      other: classification.includes("other"),
    };
  };

  const taxClass = getTaxClassificationChecks();

  return (
    <div className="w-full">
      <div className="flex justify-end mb-4">
        <Button onClick={handleDownload} size="sm" disabled={isDownloading}>
          {isDownloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isDownloading ? "Generating..." : "Download PDF"}
        </Button>
      </div>

      <ScrollArea className="h-[65vh]">
        <div className="bg-white text-black p-4 md:p-6 text-xs md:text-sm" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          {/* Header */}
          <div className="border-b-2 border-black pb-2 mb-2">
            <div className="flex flex-col md:flex-row md:justify-between gap-2">
              <div className="md:w-1/5">
                <div className="text-2xl md:text-3xl font-bold">W-9</div>
                <div className="text-[10px]">(Rev. March 2024)</div>
                <div className="text-[10px] mt-1 leading-tight">
                  Department of the Treasury<br />
                  Internal Revenue Service
                </div>
              </div>
              <div className="md:w-3/5 text-center">
                <div className="text-sm md:text-base font-bold leading-tight">
                  Request for Taxpayer<br />
                  Identification Number and Certification
                </div>
                <div className="text-[10px] mt-1">Go to www.irs.gov/FormW9 for instructions and the latest information.</div>
              </div>
              <div className="md:w-1/5 text-right text-[10px] font-bold leading-tight">
                Give form to the<br />
                requester. Do not<br />
                send to the IRS.
              </div>
            </div>
          </div>

          {/* Instruction Box */}
          <div className="border border-black bg-gray-100 p-2 mb-2 text-[10px]">
            Before you begin. For guidance related to the purpose of Form W-9, see Purpose of Form, below.
          </div>

          {/* Form Container */}
          <div className="border border-black">
            {/* Line 1 */}
            <div className="border-b border-black p-2">
              <div className="text-[10px]">
                <span className="font-bold">1</span> Name of entity/individual. An entry is required.
                <span className="italic"> (For a sole proprietor or disregarded entity, enter the owner's name on line 1, and enter the business/disregarded entity's name on line 2.)</span>
              </div>
              <div className="mt-1 font-medium text-sm md:text-base min-h-[20px]">
                {w9Form.name_on_return}
              </div>
            </div>

            {/* Line 2 */}
            <div className="border-b border-black p-2">
              <div className="text-[10px]">
                <span className="font-bold">2</span> Business name/disregarded entity name, if different from above.
              </div>
              <div className="mt-1 font-medium text-sm md:text-base min-h-[20px]">
                {w9Form.business_name || ""}
              </div>
            </div>

            {/* Line 3a and 4 */}
            <div className="border-b border-black flex flex-col md:flex-row">
              <div className="md:w-2/3 p-2 md:border-r border-b md:border-b-0 border-black">
                <div className="text-[10px] mb-2">
                  <span className="font-bold">3a</span> Check the appropriate box for federal tax classification of the entity/individual whose name is entered on line 1. Check only <span className="font-bold">one</span> of the following seven boxes.
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={taxClass.individual} readOnly className="w-3 h-3" />
                    Individual/sole proprietor
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={taxClass.cCorp} readOnly className="w-3 h-3" />
                    C corporation
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={taxClass.sCorp} readOnly className="w-3 h-3" />
                    S corporation
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={taxClass.partnership} readOnly className="w-3 h-3" />
                    Partnership
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={taxClass.trustEstate} readOnly className="w-3 h-3" />
                    Trust/estate
                  </label>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px]">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={taxClass.llc} readOnly className="w-3 h-3" />
                    LLC. Enter the tax classification (C = C corporation, S = S corporation, P = Partnership)
                  </label>
                  <span className="border-b border-black px-2 min-w-[20px] text-center font-medium">
                    {w9Form.llc_tax_classification || ""}
                  </span>
                </div>
                <div className="text-[9px] mt-2 italic">
                  Note: Check the "LLC" box above and, in the entry space, enter the appropriate code (C, S, or P) for the tax classification of the LLC, unless it is a disregarded entity.
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px]">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={taxClass.other} readOnly className="w-3 h-3" />
                    Other (see instructions) ▶
                  </label>
                  <span className="flex-1 border-b border-black px-1 min-h-[16px]">
                    {w9Form.other_classification || ""}
                  </span>
                </div>
              </div>
              <div className="md:w-1/3 p-2">
                <div className="text-[10px] mb-2">
                  <span className="font-bold">4</span> Exemptions (codes apply only to certain entities, not individuals; see instructions on page 3):
                </div>
                <div className="text-[10px] mt-2">
                  Exempt payee code (if any)
                  <span className="border-b border-black ml-2 px-2 inline-block min-w-[40px]">
                    {w9Form.exempt_payee_code || ""}
                  </span>
                </div>
                <div className="text-[10px] mt-2">
                  Exemption from FATCA reporting code (if any)
                  <span className="border-b border-black ml-2 px-2 inline-block min-w-[40px]">
                    {w9Form.fatca_exemption_code || ""}
                  </span>
                </div>
                <div className="text-[9px] mt-1 italic">
                  (Applies to accounts maintained outside the United States.)
                </div>
              </div>
            </div>

            {/* Line 3b */}
            <div className="border-b border-black p-2 text-[10px]">
              <span className="font-bold">3b</span> If on line 3a you checked "Partnership" or "Trust/estate," or checked "LLC" and entered "P" as its tax classification, and you are providing this form to a partnership, trust, or estate in which you have an ownership interest, check this box if you have any foreign partners, owners, or beneficiaries. See instructions
              <label className="ml-4 inline-flex items-center gap-1">
                <input type="checkbox" checked={w9Form.has_foreign_partners} readOnly className="w-3 h-3" />
                Check if applicable
              </label>
            </div>

            {/* Lines 5-6 */}
            <div className="border-b border-black flex flex-col md:flex-row">
              <div className="md:w-3/5 p-2 md:border-r border-b md:border-b-0 border-black">
                <div className="text-[10px]">
                  <span className="font-bold">5</span> Address (number, street, and apt. or suite no.). See instructions.
                </div>
                <div className="mt-1 font-medium min-h-[20px]">
                  {w9Form.address}
                </div>
              </div>
              <div className="md:w-2/5 p-2">
                <div className="text-[10px]">Requester's name and address (optional)</div>
                <div className="mt-1 min-h-[20px]"></div>
              </div>
            </div>

            <div className="border-b border-black flex flex-col md:flex-row">
              <div className="md:w-3/5 p-2 md:border-r border-b md:border-b-0 border-black">
                <div className="text-[10px]">
                  <span className="font-bold">6</span> City, state, and ZIP code
                </div>
                <div className="mt-1 font-medium min-h-[20px]">
                  {[w9Form.city, w9Form.state, w9Form.zip].filter(Boolean).join(", ")}
                </div>
              </div>
              <div className="md:w-2/5 p-2">
                <div className="min-h-[20px]"></div>
              </div>
            </div>

            {/* Line 7 */}
            <div className="border-b border-black p-2">
              <div className="text-[10px]">
                <span className="font-bold">7</span> List account number(s) here (optional)
              </div>
              <div className="mt-1 font-medium min-h-[20px]">
                {w9Form.account_numbers || ""}
              </div>
            </div>
          </div>

          {/* Part I - TIN */}
          <div className="bg-black text-white px-2 py-1 mt-4 font-bold text-sm">
            Part I &nbsp;&nbsp;&nbsp;&nbsp; Taxpayer Identification Number (TIN)
          </div>
          <div className="border border-black border-t-0 p-3">
            <div className="text-[10px] leading-tight">
              Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid backup withholding. For individuals, this is generally your social security number (SSN). However, for a resident alien, sole proprietor, or disregarded entity, see the instructions for Part I, later. For other entities, it is your employer identification number (EIN). If you do not have a number, see How to get a TIN, later.
            </div>
            <div className="text-[10px] mt-2 leading-tight">
              <strong>Note:</strong> If the account is in more than one name, see the instructions for line 1. See also What Name and Number To Give the Requester for guidelines on whose number to enter.
            </div>

            <div className="flex flex-col md:flex-row gap-4 mt-4">
              <div className="md:w-1/2">
                <div className="font-bold text-xs mb-2">Social security number</div>
                {w9Form.tin_type === "ssn" && ssn ? (
                  <div className="flex items-center gap-1">
                    <div className="border border-black px-2 py-1 font-mono text-center min-w-[40px]">{ssn.ssn1}</div>
                    <span>–</span>
                    <div className="border border-black px-2 py-1 font-mono text-center min-w-[30px]">{ssn.ssn2}</div>
                    <span>–</span>
                    <div className="border border-black px-2 py-1 font-mono text-center min-w-[50px]">{ssn.ssn3}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-gray-400">
                    <div className="border border-gray-300 px-2 py-1 font-mono text-center min-w-[40px]">___</div>
                    <span>–</span>
                    <div className="border border-gray-300 px-2 py-1 font-mono text-center min-w-[30px]">__</div>
                    <span>–</span>
                    <div className="border border-gray-300 px-2 py-1 font-mono text-center min-w-[50px]">____</div>
                  </div>
                )}
              </div>

              <div className="md:w-1/2 md:border-l md:border-black md:pl-4">
                <div className="text-center font-bold mb-1">or</div>
                <div className="font-bold text-xs mb-2">Employer identification number</div>
                {w9Form.tin_type === "ein" && ein ? (
                  <div className="flex items-center gap-1">
                    <div className="border border-black px-2 py-1 font-mono text-center min-w-[30px]">{ein.ein1}</div>
                    <span>–</span>
                    <div className="border border-black px-2 py-1 font-mono text-center min-w-[80px]">{ein.ein2}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-gray-400">
                    <div className="border border-gray-300 px-2 py-1 font-mono text-center min-w-[30px]">__</div>
                    <span>–</span>
                    <div className="border border-gray-300 px-2 py-1 font-mono text-center min-w-[80px]">_______</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Part II - Certification */}
          <div className="bg-black text-white px-2 py-1 mt-4 font-bold text-sm">
            Part II &nbsp;&nbsp;&nbsp;&nbsp; Certification
          </div>
          <div className="border border-black border-t-0 p-3">
            <div className="text-[10px]">
              <p className="font-bold mb-2">Under penalties of perjury, I certify that:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and</li>
                <li>I am not subject to backup withholding because (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and</li>
                <li>I am a U.S. citizen or other U.S. person (defined below); and</li>
                <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
              </ol>
            </div>

            <div className="text-[9px] mt-4 italic">
              <strong>Certification instructions.</strong> You must cross out item 2 above if you have been notified by the IRS that you are currently subject to backup withholding because you have failed to report all interest and dividends on your tax return.
            </div>

            {/* Certification Checkboxes */}
            <div className="mt-4 space-y-2 text-[10px]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={w9Form.certified_correct_tin} readOnly className="w-3 h-3" />
                I certify the TIN provided is correct
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={w9Form.certified_not_subject_backup_withholding} readOnly className="w-3 h-3" />
                I am not subject to backup withholding
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={w9Form.certified_us_person} readOnly className="w-3 h-3" />
                I am a U.S. citizen or other U.S. person
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={w9Form.certified_fatca_exempt} readOnly className="w-3 h-3" />
                The FATCA code(s) entered are correct
              </label>
            </div>

            {/* Signature */}
            <div className="mt-6 border-t border-black pt-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="text-[10px] font-bold mb-1">Sign Here</div>
                  <div className="border-b border-black min-h-[40px] flex items-end pb-1">
                    {w9Form.signature_data && (
                      <img 
                        src={w9Form.signature_data} 
                        alt="Signature" 
                        className="max-h-[35px] max-w-[200px] object-contain"
                      />
                    )}
                  </div>
                  <div className="text-[9px] mt-1">Signature of U.S. person</div>
                </div>
                <div className="md:w-1/4">
                  <div className="text-[10px] font-bold mb-1">Date</div>
                  <div className="border-b border-black min-h-[40px] flex items-end pb-1 px-2">
                    {w9Form.signature_date && format(new Date(w9Form.signature_date), "MM/dd/yyyy")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 text-[9px] text-gray-600 flex justify-between">
            <span>Cat. No. 10231X</span>
            <span>Form W-9 (Rev. 3-2024)</span>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
