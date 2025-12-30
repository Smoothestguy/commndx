import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrashTable } from "@/components/trash/TrashTable";
import { useDeletedItems, TrashEntityType } from "@/integrations/supabase/hooks/useTrash";
import { Trash2 } from "lucide-react";

const ENTITY_TABS: { value: TrashEntityType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "purchase_order", label: "Purchase Orders" },
  { value: "invoice", label: "Invoices" },
  { value: "estimate", label: "Estimates" },
  { value: "vendor_bill", label: "Vendor Bills" },
  { value: "job_order", label: "Job Orders" },
  { value: "change_order", label: "Change Orders" },
  { value: "customer", label: "Customers" },
  { value: "vendor", label: "Vendors" },
  { value: "personnel", label: "Personnel" },
  { value: "project", label: "Projects" },
  { value: "product", label: "Products" },
];

const Trash = () => {
  const [activeTab, setActiveTab] = useState<TrashEntityType | "all">("all");
  
  const { data: deletedItems, isLoading } = useDeletedItems(
    activeTab === "all" ? undefined : activeTab,
    100
  );

  return (
    <PageLayout
      title="Trash"
      description="View and restore recently deleted items"
    >
      <div className="flex items-center gap-2 mb-6">
        <Trash2 className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Deleted items can be restored here. Permanently deleted items cannot be recovered.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TrashEntityType | "all")}>
        <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
          {ENTITY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab}>
          <TrashTable
            items={deletedItems || []}
            isLoading={isLoading}
            showEntityType={activeTab === "all"}
          />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

export default Trash;
