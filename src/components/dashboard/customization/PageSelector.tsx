import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PageOption {
  id: string;
  label: string;
}

const AVAILABLE_PAGES: PageOption[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "products", label: "Products" },
  { id: "customers", label: "Customers" },
  { id: "projects", label: "Projects" },
  { id: "personnel", label: "Personnel" },
  { id: "estimates", label: "Estimates" },
  { id: "purchase-orders", label: "Purchase Orders" },
  { id: "invoices", label: "Invoices" },
  { id: "messages", label: "Messages" },
  { id: "settings", label: "Settings" },
];

interface PageSelectorProps {
  selectedPages: string[];
  onChange: (pages: string[]) => void;
}

export function PageSelector({ selectedPages, onChange }: PageSelectorProps) {
  const handleToggle = (pageId: string) => {
    if (selectedPages.includes(pageId)) {
      onChange(selectedPages.filter((id) => id !== pageId));
    } else {
      onChange([...selectedPages, pageId]);
    }
  };

  const handleSelectAll = () => {
    onChange(AVAILABLE_PAGES.map((p) => p.id));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs">Show on Pages</Label>
      <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2 bg-background/50">
        {AVAILABLE_PAGES.map((page) => (
          <div key={page.id} className="flex items-center space-x-2">
            <Checkbox
              id={`page-${page.id}`}
              checked={selectedPages.includes(page.id)}
              onCheckedChange={() => handleToggle(page.id)}
            />
            <Label
              htmlFor={`page-${page.id}`}
              className="text-xs font-normal cursor-pointer"
            >
              {page.label}
            </Label>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-7 flex-1"
          onClick={handleSelectAll}
        >
          Select All
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-7 flex-1"
          onClick={handleDeselectAll}
        >
          Deselect All
        </Button>
      </div>
    </div>
  );
}
