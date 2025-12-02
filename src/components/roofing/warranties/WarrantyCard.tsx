import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Calendar, Eye, Trash2, AlertTriangle } from "lucide-react";
import { format, differenceInDays, isBefore } from "date-fns";
import type { RoofWarranty } from "@/types/roofing";

interface WarrantyCardProps {
  warranty: RoofWarranty;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  claimed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  voided: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const typeColors: Record<string, string> = {
  manufacturer: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  workmanship: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  extended: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
};

export function WarrantyCard({ warranty, onView, onDelete }: WarrantyCardProps) {
  const endDate = new Date(warranty.end_date);
  const today = new Date();
  const daysUntilExpiry = differenceInDays(endDate, today);
  const isExpiringSoon = daysUntilExpiry <= 90 && daysUntilExpiry > 0;
  const isExpired = isBefore(endDate, today);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {warranty.customer?.name || "Unknown Customer"}
            </CardTitle>
          </div>
          <Badge className={statusColors[warranty.status]}>
            {warranty.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge className={typeColors[warranty.warranty_type]}>
            {warranty.warranty_type}
          </Badge>
        </div>

        <div className="text-sm">
          <span className="text-muted-foreground">Provider: </span>
          <span className="font-medium">{warranty.provider}</span>
        </div>

        {warranty.project?.name && (
          <div className="text-sm">
            <span className="text-muted-foreground">Project: </span>
            <span className="font-medium">{warranty.project.name}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Start: </span>
            <span>{format(new Date(warranty.start_date), "PP")}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">End: </span>
            <span>{format(endDate, "PP")}</span>
          </div>
        </div>

        {isExpiringSoon && !isExpired && (
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Expires in {daysUntilExpiry} days</span>
          </div>
        )}

        {isExpired && warranty.status === "active" && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Warranty has expired</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(warranty.id)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(warranty.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
