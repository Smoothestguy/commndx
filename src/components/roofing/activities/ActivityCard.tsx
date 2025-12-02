import { Phone, Mail, Users, FileText, MapPin, RefreshCw, Calendar, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import type { Activity, ActivityType, ActivityPriority } from "@/types/roofing";

interface ActivityCardProps {
  activity: Activity;
  onEdit?: (activity: Activity) => void;
  onDelete?: (id: string) => void;
}

const activityIcons: Record<ActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  site_visit: MapPin,
  follow_up: RefreshCw,
};

const activityColors: Record<ActivityType, string> = {
  call: "bg-blue-500/10 text-blue-500",
  email: "bg-purple-500/10 text-purple-500",
  meeting: "bg-green-500/10 text-green-500",
  note: "bg-gray-500/10 text-gray-500",
  site_visit: "bg-orange-500/10 text-orange-500",
  follow_up: "bg-yellow-500/10 text-yellow-500",
};

const priorityColors: Record<ActivityPriority, string> = {
  low: "bg-gray-500/10 text-gray-500",
  medium: "bg-blue-500/10 text-blue-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-red-500/10 text-red-500",
};

export function ActivityCard({ activity, onEdit, onDelete }: ActivityCardProps) {
  const Icon = activityIcons[activity.activity_type];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${activityColors[activity.activity_type]}`}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium truncate">{activity.subject}</h3>
                <p className="text-sm text-muted-foreground">
                  {activity.customer?.name}
                  {activity.project && ` • ${activity.project.name}`}
                </p>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(activity)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(activity.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {activity.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {activity.description}
              </p>
            )}
            
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className={activityColors[activity.activity_type]}>
                {activity.activity_type.replace("_", " ")}
              </Badge>
              
              {activity.priority && (
                <Badge variant="outline" className={priorityColors[activity.priority]}>
                  {activity.priority}
                </Badge>
              )}
              
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                <Calendar className="h-3 w-3" />
                {format(new Date(activity.activity_date), "MMM d, yyyy h:mm a")}
              </div>
            </div>
            
            {activity.follow_up_date && (
              <p className="text-xs text-muted-foreground mt-2">
                Follow-up: {format(new Date(activity.follow_up_date), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
