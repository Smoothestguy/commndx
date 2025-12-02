import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, Thermometer, Droplets, Wind, MapPin, Trash2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import type { WeatherLog } from "@/types/roofing";

interface WeatherCardProps {
  log: WeatherLog;
  onDelete: (id: string) => void;
}

const conditionIcons: Record<string, string> = {
  sunny: "☀️",
  partly_cloudy: "⛅",
  cloudy: "☁️",
  rainy: "🌧️",
  stormy: "⛈️",
  snowy: "❄️",
  windy: "💨",
  foggy: "🌫️",
};

export function WeatherCard({ log, onDelete }: WeatherCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {format(new Date(log.log_date), "EEEE, MMM d")}
            </CardTitle>
          </div>
          {log.work_suitable ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Work OK
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
              <XCircle className="h-3 w-3 mr-1" />
              No Work
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{log.location}</span>
        </div>

        {log.project?.name && (
          <div className="text-sm">
            <span className="text-muted-foreground">Project: </span>
            <span className="font-medium">{log.project.name}</span>
          </div>
        )}

        {log.conditions && (
          <div className="flex items-center gap-2 text-lg">
            <span>{conditionIcons[log.conditions] || "🌤️"}</span>
            <span className="capitalize text-sm">{log.conditions.replace("_", " ")}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          {(log.temperature_high || log.temperature_low) && (
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-orange-500" />
              <span>
                {log.temperature_high && `${log.temperature_high}°`}
                {log.temperature_high && log.temperature_low && " / "}
                {log.temperature_low && `${log.temperature_low}°`}
              </span>
            </div>
          )}

          {log.precipitation !== undefined && log.precipitation !== null && (
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              <span>{log.precipitation}" precip</span>
            </div>
          )}

          {log.wind_speed !== undefined && log.wind_speed !== null && (
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-gray-500" />
              <span>{log.wind_speed} mph</span>
            </div>
          )}
        </div>

        {log.notes && (
          <p className="text-sm text-muted-foreground border-t pt-2">{log.notes}</p>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="destructive" size="sm" onClick={() => onDelete(log.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
