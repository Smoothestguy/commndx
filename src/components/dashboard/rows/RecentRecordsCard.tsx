import { Link } from "react-router-dom";
import { Clock, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecentPages } from "@/hooks/useRecentPages";

export function RecentRecordsCard() {
  const recentPages = useRecentPages();
  const items = recentPages.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Recently Viewed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Pages you visit will appear here.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((page, i) => (
              <li key={`${page.path}-${i}`}>
                <Link
                  to={page.path}
                  className="group flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <span className="font-medium truncate">{page.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(page.visitedAt, { addSuffix: true })}
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
