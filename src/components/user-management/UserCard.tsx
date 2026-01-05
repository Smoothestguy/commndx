import { useState } from "react";
import { User, Mail, Calendar, Loader2, Shield, Trash2, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPermissionsDialog } from "./UserPermissionsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  onDelete: (userId: string) => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
  index: number;
}

export function UserCard({ user, onRoleChange, onDelete, isUpdating, isDeleting, index }: UserCardProps) {
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isMobile = useIsMobile();

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
    if (role === "personnel") return "border-l-orange-500";
    if (role === "accounting") return "border-l-emerald-500";
    return "border-l-border";
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    if (role === "admin") return "default";
    if (role === "manager") return "secondary";
    if (role === "personnel") return "outline";
    if (role === "accounting") return "secondary";
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
    <>
      <div
        className={cn(
          "glass rounded-xl border-l-4 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300",
          getRoleBorderColor(user.role),
          isMobile ? "p-4" : "p-6"
        )}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex items-start gap-3 md:gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className={cn(
              "rounded-full bg-primary/10 flex items-center justify-center",
              isMobile ? "w-10 h-10" : "w-12 h-12"
            )}>
              <span className={cn("font-semibold text-primary", isMobile ? "text-base" : "text-lg")}>
                {getInitials()}
              </span>
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0 space-y-2 md:space-y-3">
            {/* Name and Role Badge */}
            <div className="flex items-center justify-between gap-2">
              <h3 className={cn("font-semibold truncate", isMobile ? "text-base" : "text-lg")}>
                {getDisplayName()}
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize flex-shrink-0 text-xs">
                  {user.role || "No role"}
                </Badge>
                {/* Mobile: Dropdown for actions */}
                {isMobile && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={() => setPermissionsOpen(true)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Edit Permissions
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
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
            <div className="pt-2 space-y-2">
              <Select
                value={user.role || ""}
                onValueChange={handleRoleChange}
                disabled={isUpdating || isChangingRole || isDeleting}
              >
                <SelectTrigger className="w-full min-h-[44px]">
                  {(isUpdating || isChangingRole) ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating...</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Change role" />
                  )}
                </SelectTrigger>
                <SelectContent className="bg-popover">
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
                  <SelectItem value="personnel">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-orange-500" />
                      <span>Personnel (Staff)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="accounting">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-emerald-500" />
                      <span>Accounting</span>
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

              {/* Desktop: Show full buttons */}
              {!isMobile && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setPermissionsOpen(true)}
                    disabled={isDeleting}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Edit Permissions
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Removing...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove User
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove User</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove <strong>{getDisplayName()}</strong> ({user.email})? 
                          This action cannot be undone. The user will lose access to the system and all their 
                          role assignments will be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(user.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove User
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{getDisplayName()}</strong> ({user.email})? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(user.id);
                setDeleteDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserPermissionsDialog
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        userId={user.id}
        userName={getDisplayName()}
        userRole={user.role}
      />
    </>
  );
}
