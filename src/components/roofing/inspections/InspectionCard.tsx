import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Calendar, User, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { RoofInspection } from "@/types/roofing";

interface InspectionCardProps {
  inspection: RoofInspection;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

const conditionColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  poor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function InspectionCard({ inspection, onView, onDelete }: InspectionCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {inspection.customer?.name || "Unknown Customer"}
            </CardTitle>
          </div>
          <Badge className={statusColors[inspection.status]}>
            {inspection.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(inspection.inspection_date), "PPP")}</span>
        </div>

        {inspection.project?.name && (
          <div className="text-sm">
            <span className="text-muted-foreground">Project: </span>
            <span className="font-medium">{inspection.project.name}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Type: </span>
          <Badge variant="outline" className="capitalize">
            {inspection.inspection_type.replace("_", " ")}
          </Badge>
        </div>

        {inspection.overall_condition && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Condition: </span>
            <Badge className={conditionColors[inspection.overall_condition]}>
              {inspection.overall_condition}
            </Badge>
          </div>
        )}

        {inspection.inspector && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>
              {inspection.inspector.first_name} {inspection.inspector.last_name}
            </span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(inspection.id)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(inspection.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
