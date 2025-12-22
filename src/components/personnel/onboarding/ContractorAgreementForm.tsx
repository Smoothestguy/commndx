import { useState, useRef, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignaturePad } from "@/components/form-builder/SignaturePad";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Info } from "lucide-react";

interface ContractorAgreementFormProps {
  data: {
    ica_signature: string | null;
  };
  onChange: (field: string, value: string | null) => void;
  personnelData: {
    first_name: string;
    last_name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
}

export function ContractorAgreementForm({ data, onChange, personnelData }: ContractorAgreementFormProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const fullName = `${personnelData.first_name} ${personnelData.last_name}`;
  const fullAddress = [
    personnelData.address,
    [personnelData.city, personnelData.state, personnelData.zip].filter(Boolean).join(", ")
  ].filter(Boolean).join(", ");

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Check if user has scrolled to bottom
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Please read the Independent Contractor Agreement carefully. You must scroll to the bottom
          before you can sign.
        </AlertDescription>
      </Alert>

      {/* Agreement Content */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Independent Contractor Agreement
        </h3>

        <div className="border rounded-lg">
          <ScrollArea 
            className="h-[400px] p-4" 
            onScrollCapture={handleScroll}
            ref={scrollAreaRef}
          >
            <div className="space-y-4 text-sm pr-4">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold">INDEPENDENT CONTRACTOR AGREEMENT</h2>
              </div>

              <p>
                This Independent Contractor Agreement ("Agreement") is entered into as of{" "}
                <strong>{currentDate}</strong>, by and between Fairfield Response Group LLC, a 
                company with its principal address at 12519 Millvan Ct, Houston, TX 77070 
                ("Company"), and <strong>{fullName}</strong>, with an address at{" "}
                <strong>{fullAddress || "[Address]"}</strong> ("Contractor").
              </p>

              <h3 className="font-bold mt-6">1. Independent Contractor Relationship</h3>
              <p>
                1.1. The Contractor shall perform temporary labor services for the Company as an 
                independent contractor and not as an employee. Nothing in this Agreement shall be 
                construed to create an employer-employee relationship, partnership, joint venture, 
                or any other relationship other than that of an independent contractor.
              </p>
              <p>
                1.2. The Contractor shall have no authority to bind or obligate the Company in any 
                manner, unless specifically authorized in writing by the Company.
              </p>

              <h3 className="font-bold mt-6">2. Services to Be Provided</h3>
              <p>
                2.1. The Contractor agrees to provide temporary labor services as requested by the 
                Company. The scope and specifics of the services shall be outlined in work orders 
                or other written communications provided by the Company.
              </p>
              <p>
                2.2. The Contractor acknowledges that all work performed under this Agreement will 
                often be on short notice and subject to last-minute changes, including the conclusion 
                of assignments. This is due to the nature of the Company's operations in emergency 
                management and response.
              </p>
              <p>
                2.3. The Contractor shall use their own tools, equipment, and resources to perform 
                the services unless otherwise agreed upon by both parties.
              </p>

              <h3 className="font-bold mt-6">3. Compensation</h3>
              <p>
                3.1. The Contractor shall be compensated for services rendered at the rate agreed 
                upon in writing by both parties.
              </p>
              <p>
                3.2. The Contractor shall be solely responsible for the payment of all taxes, 
                including income taxes and self-employment taxes, arising from the compensation 
                received under this Agreement.
              </p>

              <h3 className="font-bold mt-6">4. Term and Termination</h3>
              <p>
                4.1. This Agreement shall commence on notice and shall continue until terminated 
                by either party.
              </p>
              <p>
                4.2. Either party may terminate this Agreement at any time, with or without cause.
              </p>

              <h3 className="font-bold mt-6">5. Independent Contractor Obligations</h3>
              <p>
                5.1. The Contractor shall comply with all applicable laws, regulations, and 
                ordinances in the performance of their services.
              </p>
              <p>
                5.2. The Contractor acknowledges that they are not entitled to any employee benefits 
                from the Company, including but not limited to health insurance, retirement benefits, 
                paid time off, or workers' compensation.
              </p>

              <h3 className="font-bold mt-6">6. Confidentiality</h3>
              <p>
                6.1. The Contractor agrees to keep confidential all information obtained during the 
                course of providing services to the Company, including but not limited to trade 
                secrets, customer information, and business operations.
              </p>
              <p>
                6.2. This confidentiality obligation shall survive the termination of this Agreement.
              </p>

              <h3 className="font-bold mt-6">7. Indemnification</h3>
              <p>
                7.1. The Contractor agrees to indemnify, defend, and hold harmless the Company, its 
                affiliates, officers, and employees from any and all claims, damages, liabilities, 
                and expenses arising from the Contractor's performance of services under this Agreement.
              </p>

              <h3 className="font-bold mt-6">8. Miscellaneous</h3>
              <p>
                8.1. This Agreement constitutes the entire agreement between the parties and supersedes 
                all prior agreements or understandings, whether written or oral.
              </p>
              <p>
                8.2. This Agreement shall be governed by and construed in accordance with the laws of 
                the State of Texas.
              </p>
              <p>
                8.3. Any amendments to this Agreement must be made in writing and signed by both parties.
              </p>
              <p>
                8.4. If any provision of this Agreement is found to be invalid or unenforceable, the 
                remaining provisions shall remain in full force and effect.
              </p>

              <div className="mt-8 pt-4 border-t">
                <p className="font-medium mb-4">
                  IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first 
                  above written.
                </p>
                
                <div className="grid grid-cols-2 gap-8 mt-6">
                  <div>
                    <p className="font-bold">Fairfield Response Group LLC</p>
                    <p className="text-muted-foreground mt-2">By: _______________________</p>
                    <p className="text-muted-foreground">Name: _______________________</p>
                    <p className="text-muted-foreground">Title: _______________________</p>
                  </div>
                  <div>
                    <p className="font-bold">Contractor</p>
                    <p className="text-muted-foreground mt-2">Name: {fullName}</p>
                    <p className="text-muted-foreground">Date: {currentDate}</p>
                  </div>
                </div>
              </div>

              <div className="h-4" /> {/* Spacer to ensure scroll detection works */}
            </div>
          </ScrollArea>
        </div>

        {hasScrolledToBottom && (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle className="h-4 w-4" />
            <span>You have read the entire agreement</span>
          </div>
        )}
      </div>

      {/* Signature Section */}
      <div className="border-t pt-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Contractor Signature
        </h3>

        {!hasScrolledToBottom ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Please scroll to the bottom of the agreement above before signing.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="p-4 bg-muted/50 rounded-lg text-sm">
              <p>
                By signing below, I, <strong>{fullName}</strong>, acknowledge that I have read, 
                understand, and agree to be bound by the terms of this Independent Contractor Agreement.
              </p>
            </div>

            <SignaturePad
              value={data.ica_signature || undefined}
              onChange={(sig) => onChange("ica_signature", sig)}
              label="Contractor Signature *"
              required
              helpText="Sign above to accept the Independent Contractor Agreement"
            />
          </>
        )}
      </div>
    </div>
  );
}
