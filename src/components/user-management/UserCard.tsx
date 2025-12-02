import { useState } from "react";
import { User, Mail, Calendar, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  role: AppRole | null;
}

interface UserCardProps {
  user: UserWithRole;
  onRoleChange: (userId: string, newRole: AppRole) => Promise<void>;
  isUpdating: boolean;
  index: number;
}

export function UserCard({ user, onRoleChange, isUpdating, index }: UserCardProps) {
  const [isChangingRole, setIsChangingRole] = useState(false);

  const handleRoleChange = async (newRole: AppRole) => {
    setIsChangingRole(true);
    try {
      await onRoleChange(user.id, newRole);
    } finally {
      setIsChangingRole(false);
    }
  };

  const getRoleBorderColor = (role: AppRole | null) => {
    if (role === "admin") return "border-l-cyan-500";
    if (role === "manager") return "border-l-purple-500";
    return "border-l-border";
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    if (role === "admin") return "default";
    if (role === "manager") return "secondary";
    return "outline";
  };

  const getInitials = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  return (
    <div
      className={`glass rounded-xl p-6 border-l-4 ${getRoleBorderColor(user.role)} hover:shadow-lg hover:shadow-primary/20 transition-all duration-300`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-semibold text-primary">{getInitials()}</span>
          </div>
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Name and Role Badge */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-lg truncate">{getDisplayName()}</h3>
            <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize flex-shrink-0">
              {user.role || "No role"}
            </Badge>
          </div>

          {/* Email */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>

          {/* Joined Date */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>Joined {format(new Date(user.created_at), "MMM d, yyyy")}</span>
          </div>

          {/* Role Change Selector */}
          <div className="pt-2">
            <Select
              value={user.role || ""}
              onValueChange={handleRoleChange}
              disabled={isUpdating || isChangingRole}
            >
              <SelectTrigger className="w-full">
                {(isUpdating || isChangingRole) ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating...</span>
                  </div>
                ) : (
                  <SelectValue placeholder="Change role" />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-cyan-500" />
                    <span>Admin</span>
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-purple-500" />
                    <span>Manager</span>
                  </div>
                </SelectItem>
                <SelectItem value="user">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>User</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
