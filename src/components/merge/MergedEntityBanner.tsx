import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GitMerge, ExternalLink } from "lucide-react";
import { EntityType } from "@/hooks/useEntityMerge";

interface MergedEntityBannerProps {
  entityType: EntityType;
  mergedIntoId: string;
  mergedIntoName: string;
  mergedAt: string;
  mergedByEmail?: string;
}

export function MergedEntityBanner({
  entityType,
  mergedIntoId,
  mergedIntoName,
  mergedAt,
  mergedByEmail,
}: MergedEntityBannerProps) {
  const getEntityPath = () => {
    switch (entityType) {
      case "customer":
        return `/customers/${mergedIntoId}`;
      case "vendor":
        return `/vendors/${mergedIntoId}`;
      case "personnel":
        return `/personnel/${mergedIntoId}`;
      default:
        return "#";
    }
  };

  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
      <GitMerge className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">
        This record has been merged
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p>
          This {entityType} was merged into{" "}
          <span className="font-medium">{mergedIntoName}</span> on{" "}
          {format(new Date(mergedAt), "PPP")}
          {mergedByEmail && <span> by {mergedByEmail}</span>}.
        </p>
        <p className="mt-1">
          All historical data has been preserved and transferred to the surviving record.
        </p>
        <Button
          variant="link"
          asChild
          className="h-auto p-0 mt-2 text-amber-800 dark:text-amber-200"
        >
          <Link to={getEntityPath()} className="flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            View Surviving Record
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
