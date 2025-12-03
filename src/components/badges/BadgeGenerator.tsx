import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBadgeTemplates, useDefaultBadgeTemplate } from "@/integrations/supabase/hooks/useBadgeTemplates";
import { usePersonnel, usePersonnelById } from "@/integrations/supabase/hooks/usePersonnel";
import { BadgePreview } from "./BadgePreview";
import { generateBadgePDF, generateBulkBadgePDF } from "@/utils/badgePdfExport";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

interface BadgeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personnelId?: string;
}

export const BadgeGenerator = ({
  open,
  onOpenChange,
  personnelId,
}: BadgeGeneratorProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>(
    personnelId ? [personnelId] : []
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: templates } = useBadgeTemplates();
  const { data: defaultTemplate } = useDefaultBadgeTemplate();
  const { data: personnelList } = usePersonnel({ status: "active" });
  
  // Fetch complete personnel data with relations for preview
  const { data: selectedPersonnelFull } = usePersonnelById(selectedPersonnelIds[0]);

  // Auto-select default template when dialog opens
  useEffect(() => {
    if (open && !selectedTemplateId && defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [open, defaultTemplate, selectedTemplateId]);

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }

    if (selectedPersonnelIds.length === 0) {
      toast.error("Please select personnel");
      return;
    }

    setIsGenerating(true);

    try {
      if (selectedPersonnelIds.length === 1 && selectedPersonnelFull) {
        await generateBadgePDF(selectedPersonnelFull, selectedTemplate);
        toast.success("Badge generated successfully");
      } else {
        const selectedPersonnelData = personnelList?.filter((p) =>
          selectedPersonnelIds.includes(p.id)
        );
        if (selectedPersonnelData) {
          await generateBulkBadgePDF(selectedPersonnelData, selectedTemplate);
          toast.success(`Generated ${selectedPersonnelIds.length} badges`);
        }
      }
    } catch (error) {
      toast.error("Failed to generate badge");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Badge</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-1">
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Badge Template</label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.is_default && " (Default)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!personnelId && (
                <div>
                  <label className="text-sm font-medium">Personnel</label>
                  <Select
                    value={selectedPersonnelIds[0] || ""}
                    onValueChange={(value) => setSelectedPersonnelIds([value])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select personnel" />
                    </SelectTrigger>
                    <SelectContent>
                      {personnelList?.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.first_name} {person.last_name} (
                          {person.personnel_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedTemplate && selectedPersonnelFull && (
              <div className="flex justify-center p-6 bg-muted rounded-lg overflow-x-auto">
                <BadgePreview
                  personnel={selectedPersonnelFull}
                  template={selectedTemplate}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full sm:w-auto">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
