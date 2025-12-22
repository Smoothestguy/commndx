import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { downloadICAForm, ICAFormData } from "@/lib/generateICA";

interface ICAFormPreviewProps {
  data: ICAFormData;
}

export function ICAFormPreview({ data }: ICAFormPreviewProps) {
  const handleDownload = () => {
    downloadICAForm(data);
  };

  const sections = [
    {
      title: '1. ENGAGEMENT',
      content: 'The Company hereby engages the Contractor, and the Contractor agrees to provide services to the Company as an independent contractor, subject to the terms and conditions set forth in this Agreement.'
    },
    {
      title: '2. SERVICES',
      content: 'The Contractor shall provide such services as may be assigned by the Company from time to time. The Contractor shall perform all services in a professional and workmanlike manner, consistent with industry standards.'
    },
    {
      title: '3. INDEPENDENT CONTRACTOR STATUS',
      content: 'The Contractor is an independent contractor and not an employee, partner, or agent of the Company. The Contractor shall not be entitled to any employee benefits, including but not limited to health insurance, retirement benefits, or paid time off. The Contractor is responsible for paying all taxes arising from compensation received under this Agreement.'
    },
    {
      title: '4. COMPENSATION',
      content: "The Company shall pay the Contractor for services at rates agreed upon in writing. Payment shall be made according to the Company's standard payment schedule for contractors."
    },
    {
      title: '5. CONFIDENTIALITY',
      content: 'The Contractor agrees to keep confidential all proprietary information, trade secrets, and business information of the Company and its clients. This obligation shall survive the termination of this Agreement.'
    },
    {
      title: '6. WORK PRODUCT',
      content: 'All work product created by the Contractor in the performance of services under this Agreement shall be the sole property of the Company or its clients, as applicable.'
    },
    {
      title: '7. INSURANCE',
      content: "The Contractor shall maintain adequate liability insurance and workers' compensation insurance as required by law."
    },
    {
      title: '8. TERMINATION',
      content: 'Either party may terminate this Agreement at any time, with or without cause, upon written notice to the other party.'
    },
    {
      title: '9. GOVERNING LAW',
      content: 'This Agreement shall be governed by and construed in accordance with the laws of the state in which the Company is located.'
    }
  ];

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
          <div className="text-center mb-6">
            <div className="text-4xl font-black tracking-wider text-gray-300 leading-none">
              FAIRFIELD
            </div>
            <div className="flex items-center justify-center mt-[-6px]">
              <div className="w-52 h-6 bg-gradient-to-r from-gray-300 to-transparent"></div>
              <div className="text-xl font-light tracking-widest text-gray-300 ml-2">
                GROUP
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center border-b pb-4 mb-4">
            <h1 className="text-lg font-bold">INDEPENDENT CONTRACTOR AGREEMENT</h1>
            <p className="text-muted-foreground text-xs mt-1">
              {data.signedAt 
                ? `This Agreement is entered into as of ${format(new Date(data.signedAt), "MMMM dd, yyyy")}`
                : 'This Agreement is entered into as of the date signed below'
              }
            </p>
          </div>

          {/* Parties */}
          <section className="mb-4">
            <p className="font-bold mb-2">PARTIES:</p>
            <p><strong>Company:</strong> Fairfield Response Group LLC</p>
            <p><strong>Contractor:</strong> {data.contractorName}</p>
            {data.contractorAddress && (
              <p><strong>Address:</strong> {data.contractorAddress}</p>
            )}
          </section>

          {/* Agreement Sections */}
          <div className="space-y-4">
            {sections.map((section, index) => (
              <section key={index}>
                <p className="font-bold">{section.title}</p>
                <p className="text-justify leading-relaxed">{section.content}</p>
              </section>
            ))}
          </div>

          {/* Signature Section */}
          {data.signature && data.signedAt && (
            <section className="border-t pt-6 mt-6">
              <p className="font-bold mb-4">SIGNATURE</p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Contractor Signature</p>
                {data.signature?.startsWith("data:image") ? (
                  <img 
                    src={data.signature} 
                    alt="ICA Signature"
                    className="max-h-16 object-contain"
                  />
                ) : (
                  <p className="font-signature text-xl italic">{data.signature}</p>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  Signed on {format(new Date(data.signedAt), "MMMM dd, yyyy 'at' h:mm a")}
                </p>
                <p className="text-xs mt-2">
                  <strong>Printed Name:</strong> {data.contractorName}
                </p>
              </div>
            </section>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t">
            Fairfield Response Group LLC - Independent Contractor Agreement
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
