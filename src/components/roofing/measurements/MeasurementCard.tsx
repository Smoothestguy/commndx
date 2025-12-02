import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ruler, Calendar, Eye, Trash2, Square } from "lucide-react";
import { format } from "date-fns";
import type { RoofMeasurement } from "@/types/roofing";

interface MeasurementCardProps {
  measurement: RoofMeasurement;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MeasurementCard({ measurement, onView, onDelete }: MeasurementCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {measurement.customer?.name || "Unknown Customer"}
            </CardTitle>
          </div>
          {measurement.roof_type && (
            <Badge variant="outline" className="capitalize">
              {measurement.roof_type}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(measurement.measurement_date), "PPP")}</span>
        </div>

        {measurement.project?.name && (
          <div className="text-sm">
            <span className="text-muted-foreground">Project: </span>
            <span className="font-medium">{measurement.project.name}</span>
          </div>
        )}

        {/* Key area measurement */}
        {measurement.total_roof_area && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <Square className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Roof Area</p>
              <p className="font-semibold">{measurement.total_roof_area.toLocaleString()} sqft</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          {measurement.pitch && (
            <div>
              <span className="text-muted-foreground">Pitch: </span>
              <span className="font-medium">{measurement.pitch}</span>
            </div>
          )}
          {measurement.total_facets && (
            <div>
              <span className="text-muted-foreground">Facets: </span>
              <span className="font-medium">{measurement.total_facets}</span>
            </div>
          )}
          {measurement.total_squares && (
            <div>
              <span className="text-muted-foreground">Squares: </span>
              <span className="font-medium">{measurement.total_squares}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(measurement.id)}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(measurement.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
