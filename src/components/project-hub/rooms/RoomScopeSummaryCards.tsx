import { Card, CardContent } from "@/components/ui/card";
import { RoomScopeSummaryItem } from "@/integrations/supabase/hooks/useProjectRooms";

interface RoomScopeSummaryCardsProps {
  summaryItems: RoomScopeSummaryItem[];
  isLoading: boolean;
}

export function RoomScopeSummaryCards({ summaryItems, isLoading }: RoomScopeSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-3">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-6 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summaryItems || summaryItems.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {summaryItems.map((item) => {
        const pctRemaining = item.total_quantity > 0
          ? (item.remaining_quantity / item.total_quantity) * 100
          : 100;
        
        const colorClass = pctRemaining > 20
          ? 'border-l-green-500 bg-green-500/5'
          : pctRemaining > 5
          ? 'border-l-yellow-500 bg-yellow-500/5'
          : 'border-l-red-500 bg-red-500/5';

        // Short label
        const label = item.description
          .replace(/^H-[A-Z]+-\d+\.?\w*\s*/i, '')
          .replace(/^H-[A-Z]+-\d+\s*/i, '')
          || item.description;

        return (
          <Card key={item.job_order_line_item_id} className={`border-l-4 ${colorClass}`}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground font-medium truncate" title={item.description}>
                {label}
              </p>
              <p className="text-lg font-bold tabular-nums">
                {item.allocated_quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="text-xs text-muted-foreground font-normal">
                  {' / '}{item.total_quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Remaining: {item.remaining_quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
