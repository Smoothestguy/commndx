import { Trash2, RotateCcw, FileText, Receipt, Briefcase, ShoppingCart, Users, Building, FolderKanban, Package, UserCheck, FileEdit } from "lucide-react";
import { useDeletedItems, useRestoreItem, getEntityLabel, TrashEntityType } from "@/integrations/supabase/hooks/useTrash";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ENTITY_ICONS: Record<TrashEntityType, React.ComponentType<{ className?: string }>> = {
  purchase_order: ShoppingCart,
  invoice: Receipt,
  estimate: FileText,
  vendor_bill: FileEdit,
  job_order: Briefcase,
  change_order: FileEdit,
  customer: Users,
  vendor: Building,
  personnel: UserCheck,
  project: FolderKanban,
  product: Package,
};

export function RecentlyDeleted() {
  const navigate = useNavigate();
  const { data: deletedItems, isLoading } = useDeletedItems(undefined, 5);
  const restoreItem = useRestoreItem();

  return (
    <div className="glass rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="font-heading text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          Recently Deleted
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/trash")}
          className="text-xs sm:text-sm"
        >
          View all
        </Button>
      </div>
      <div className="space-y-2 sm:space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Loading...
          </p>
        ) : !deletedItems?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No deleted items
          </p>
        ) : (
          deletedItems.map((item) => {
            const Icon = ENTITY_ICONS[item.entity_type] || FileText;
            return (
              <div
                key={`${item.entity_type}-${item.id}`}
                className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-4 rounded-lg hover:bg-secondary/50 transition-colors duration-200"
              >
                <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                    {item.identifier}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getEntityLabel(item.entity_type)}
                  </p>
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                  {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => restoreItem.mutate({ entityType: item.entity_type, id: item.id })}
                  disabled={restoreItem.isPending}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
