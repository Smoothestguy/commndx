import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Loader2 } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { useBadgeTemplates, useDefaultBadgeTemplate } from "@/integrations/supabase/hooks/useBadgeTemplates";
import { usePersonnelWithRelations } from "@/integrations/supabase/hooks/usePersonnel";
import { generateBulkBadgePDF } from "@/utils/badgePdfExport";
import { toast } from "sonner";

interface BulkBadgeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedIds?: string[];
}

export const BulkBadgeGenerator = ({
  open,
  onOpenChange,
  preselectedIds = [],
}: BulkBadgeGeneratorProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedIds);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: templates } = useBadgeTemplates();
  const { data: defaultTemplate } = useDefaultBadgeTemplate();
  const { data: personnelList } = usePersonnelWithRelations({ status: "active" });

  // Set default template when dialog opens
  useEffect(() => {
    if (open && defaultTemplate && !selectedTemplateId) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [open, defaultTemplate, selectedTemplateId]);

  // Filter personnel by search query
  const filteredPersonnel = useMemo(() => {
    if (!personnelList) return [];
    if (!searchQuery) return personnelList;
    const query = searchQuery.toLowerCase();
    return personnelList.filter(
      (p) =>
        p.first_name.toLowerCase().includes(query) ||
        p.last_name.toLowerCase().includes(query) ||
        p.personnel_number.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query)
    );
  }, [personnelList, searchQuery]);

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  const handleSelectAll = () => {
    setSelectedIds(filteredPersonnel.map((p) => p.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one person");
      return;
    }

    if (!selectedTemplate) {
      toast.error("Please select a badge template");
      return;
    }

    setIsGenerating(true);
    try {
      const selectedPersonnel = personnelList?.filter((p) =>
        selectedIds.includes(p.id)
      ) || [];
      await generateBulkBadgePDF(selectedPersonnel, selectedTemplate);
      toast.success(`Generated ${selectedIds.length} badge(s) successfully`);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to generate badges:", error);
      toast.error("Failed to generate badges. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Badge Generator</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Badge Template</label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <SearchInput
            placeholder="Search personnel..."
            value={searchQuery}
            onChange={setSearchQuery}
          />

          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedIds.length} of {filteredPersonnel.length} selected
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={filteredPersonnel.length === 0}
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAll}
                disabled={selectedIds.length === 0}
              >
                Deselect All
              </Button>
            </div>
          </div>

          {/* Personnel List */}
          <ScrollArea className="h-[300px] border rounded-md">
            <div className="p-4 space-y-2">
              {filteredPersonnel.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => handleToggle(person.id)}
                >
                  <Checkbox
                    checked={selectedIds.includes(person.id)}
                    onCheckedChange={() => handleToggle(person.id)}
                  />
                  <SecureAvatar
                    bucket="personnel-photos"
                    photoUrl={person.photo_url}
                    className="h-10 w-10"
                    fallback={
                      <span>
                        {person.first_name[0]}
                        {person.last_name[0]}
                      </span>
                    }
                    alt={`${person.first_name} ${person.last_name}`}
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {person.first_name} {person.last_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {person.personnel_number}
                    </div>
                  </div>
                </div>
              ))}
              {filteredPersonnel.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No personnel found
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating || selectedIds.length === 0}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate {selectedIds.length > 0 && `(${selectedIds.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
