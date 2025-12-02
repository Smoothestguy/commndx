import { Calendar, Clock, MapPin, User, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { Appointment, AppointmentType, AppointmentStatus } from "@/types/roofing";

interface AppointmentCardProps {
  appointment: Appointment;
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (id: string) => void;
}

const typeLabels: Record<AppointmentType, string> = {
  inspection: "Inspection",
  estimate: "Estimate",
  installation: "Installation",
  follow_up: "Follow Up",
  consultation: "Consultation",
  warranty_service: "Warranty Service",
};

const statusColors: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-500",
  confirmed: "bg-green-500/10 text-green-500",
  in_progress: "bg-yellow-500/10 text-yellow-500",
  completed: "bg-gray-500/10 text-gray-500",
  cancelled: "bg-red-500/10 text-red-500",
  no_show: "bg-red-500/10 text-red-500",
};

export function AppointmentCard({ appointment, onEdit, onDelete }: AppointmentCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">{appointment.title}</h3>
              <Badge variant="outline" className={statusColors[appointment.status]}>
                {appointment.status.replace("_", " ")}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {appointment.customer?.name}
              {appointment.project && ` • ${appointment.project.name}`}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(appointment)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete?.(appointment.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(new Date(appointment.start_time), "EEEE, MMMM d, yyyy")}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(new Date(appointment.start_time), "h:mm a")} - {format(new Date(appointment.end_time), "h:mm a")}
            </span>
          </div>
          
          {appointment.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{appointment.location}</span>
            </div>
          )}
          
          {appointment.assignee && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{appointment.assignee.first_name} {appointment.assignee.last_name}</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t">
          <Badge variant="secondary">{typeLabels[appointment.appointment_type]}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
