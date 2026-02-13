import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { generateAppWalkthroughPDF } from "@/utils/appWalkthroughPdf";
import { toast } from "@/hooks/use-toast";

const AppWalkthroughDownload = () => {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await generateAppWalkthroughPDF();
      toast({ title: "PDF Downloaded", description: "Application walkthrough PDF has been generated." });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={generating} variant="outline" className="gap-2">
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {generating ? "Generating..." : "Download App Walkthrough PDF"}
    </Button>
  );
};

export default AppWalkthroughDownload;
