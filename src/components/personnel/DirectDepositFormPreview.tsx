import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { downloadDirectDepositForm, DirectDepositFormData } from "@/lib/generateDirectDeposit";

interface DirectDepositFormPreviewProps {
  data: DirectDepositFormData;
}

export function DirectDepositFormPreview({ data }: DirectDepositFormPreviewProps) {
  const handleDownload = () => {
    downloadDirectDepositForm(data);
  };

  const cityStateZip = [data.city, data.state, data.zip].filter(Boolean).join(', ');

  return (
    <div className="w-full">
      <div className="flex justify-end mb-4">
        <Button onClick={handleDownload} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <ScrollArea className="h-[65vh]">
        <div className="bg-white text-black p-6 text-sm" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          {/* Fairfield Header */}
          <div className="text-center mb-8">
            <div className="text-5xl font-black tracking-wider text-gray-300 leading-none">
              FAIRFIELD
            </div>
            <div className="flex items-center justify-center mt-[-8px]">
              <div className="w-64 h-8 bg-gradient-to-r from-gray-300 to-transparent"></div>
              <div className="text-2xl font-light tracking-widest text-gray-300 ml-2">
                GROUP
              </div>
            </div>
          </div>

          {/* Form Title */}
          <h1 className="text-lg font-bold mb-6">
            DIRECT DEPOSIT AUTHORIZATION FORM
          </h1>

          {/* Employee/Contractor Information */}
          <section className="mb-6">
            <h2 className="font-bold text-base mb-4">Employee/Contractor Information</h2>
            
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span>Name:</span>
                <span className="flex-1 border-b border-black min-h-[20px] px-1">
                  {data.name}
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-2">
                <span>Address:</span>
                <span className="w-64 border-b border-black min-h-[20px] px-1">
                  {data.address || ''}
                </span>
                <span>City, State, ZIP Code:</span>
                <span className="flex-1 border-b border-black min-h-[20px] px-1">
                  {cityStateZip}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span>Phone Number:</span>
                <span className="flex-1 border-b border-black min-h-[20px] px-1">
                  {data.phone || ''}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span>Email Address:</span>
                <span className="flex-1 border-b border-black min-h-[20px] px-1">
                  {data.email || ''}
                </span>
              </div>
            </div>
          </section>

          {/* Bank Information */}
          <section className="mb-6">
            <h2 className="font-bold text-base mb-4">Bank Information</h2>
            
            <div className="flex items-baseline gap-2">
              <span>Bank Name:</span>
              <span className="flex-1 border-b border-black min-h-[20px] px-1">
                {data.bankName || ''}
              </span>
            </div>
          </section>

          {/* Account Information */}
          <section className="mb-6">
            <h2 className="font-bold text-base mb-4">Account Information</h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span>Account Type (check one):</span>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={data.accountType?.toLowerCase() === 'checking'} 
                    readOnly 
                    className="w-4 h-4"
                  />
                  Checking
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={data.accountType?.toLowerCase() === 'savings'} 
                    readOnly 
                    className="w-4 h-4"
                  />
                  Savings
                </label>
              </div>

              <div className="flex items-baseline gap-2">
                <span>Routing Number:</span>
                <span className="flex-1 border-b border-black min-h-[20px] px-1 font-mono">
                  {data.routingNumber || ''}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span>Account Number:</span>
                <span className="flex-1 border-b border-black min-h-[20px] px-1 font-mono">
                  {data.accountNumber || ''}
                </span>
              </div>
            </div>
          </section>

          {/* Authorization */}
          <section className="mb-6">
            <h2 className="font-bold text-base mb-4">Authorization</h2>
            
            <p className="text-[10.5pt] leading-relaxed text-justify mb-4">
              I, <span className="border-b border-black px-2 inline-block min-w-[200px]">{data.name}</span>, 
              authorize Fairfield Response Group LLC to deposit payments directly into the bank account(s) 
              listed above. This authorization will remain in effect until I provide written notification 
              to cancel or change my direct deposit information.
            </p>

            <p className="text-[10.5pt] leading-relaxed text-justify">
              I understand that I am responsible for verifying deposits and ensuring accuracy. 
              Fairfield Response Group LLC is not responsible for errors or delays caused by 
              incorrect or incomplete information provided by me.
            </p>
          </section>

          {/* Signature Section */}
          <section className="mt-8">
            <div className="flex gap-8">
              <div className="flex-1 flex items-baseline gap-2">
                <span>Signature:</span>
                <div className="flex-1 border-b border-black min-h-[40px] relative">
                  {data.signature?.startsWith('data:image') ? (
                    <img 
                      src={data.signature} 
                      alt="Signature" 
                      className="absolute bottom-1 left-2 max-h-[35px] object-contain"
                    />
                  ) : data.signature ? (
                    <span className="absolute bottom-1 left-2 italic text-lg">{data.signature}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span>Date:</span>
                <span className="border-b border-black min-w-[120px] min-h-[20px] px-1">
                  {data.signedAt ? format(new Date(data.signedAt), 'MM/dd/yyyy') : ''}
                </span>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
