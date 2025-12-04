import { useState, useEffect } from "react";
import { Loader2, Shield, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserPermissions, useUpdateUserPermissions, MODULES } from "@/integrations/supabase/hooks/useUserPermissions";

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userRole: string | null;
}

type PermissionState = Record<string, {
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}>;

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userRole,
}: UserPermissionsDialogProps) {
  const { data: existingPermissions, isLoading } = useUserPermissions(userId);
  const updatePermissions = useUpdateUserPermissions();
  const [permissions, setPermissions] = useState<PermissionState>({});

  // Initialize permissions when data loads
  useEffect(() => {
    if (existingPermissions) {
      const permState: PermissionState = {};
      
      // Initialize all modules with false
      MODULES.forEach(m => {
        permState[m.key] = {
          can_view: false,
          can_add: false,
          can_edit: false,
          can_delete: false,
        };
      });

      // Override with existing permissions
      existingPermissions.forEach(p => {
        if (permState[p.module]) {
          permState[p.module] = {
            can_view: p.can_view,
            can_add: p.can_add,
            can_edit: p.can_edit,
            can_delete: p.can_delete,
          };
        }
      });

      setPermissions(permState);
    }
  }, [existingPermissions]);

  const handleToggle = (module: string, action: "can_view" | "can_add" | "can_edit" | "can_delete") => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action],
      },
    }));
  };

  const handleSelectAllModule = (module: string) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        can_view: true,
        can_add: true,
        can_edit: true,
        can_delete: true,
      },
    }));
  };

  const handleClearModule = (module: string) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        can_view: false,
        can_add: false,
        can_edit: false,
        can_delete: false,
      },
    }));
  };

  const handleGrantAllView = () => {
    setPermissions(prev => {
      const newState = { ...prev };
      MODULES.forEach(m => {
        newState[m.key] = {
          ...newState[m.key],
          can_view: true,
        };
      });
      return newState;
    });
  };

  const handleGrantAll = () => {
    setPermissions(() => {
      const newState: PermissionState = {};
      MODULES.forEach(m => {
        newState[m.key] = {
          can_view: true,
          can_add: true,
          can_edit: true,
          can_delete: true,
        };
      });
      return newState;
    });
  };

  const handleClearAll = () => {
    setPermissions(() => {
      const newState: PermissionState = {};
      MODULES.forEach(m => {
        newState[m.key] = {
          can_view: false,
          can_add: false,
          can_edit: false,
          can_delete: false,
        };
      });
      return newState;
    });
  };

  const handleSave = async () => {
    const permArray = Object.entries(permissions).map(([module, perms]) => ({
      module,
      ...perms,
    }));

    await updatePermissions.mutateAsync({ userId, permissions: permArray });
    onOpenChange(false);
  };

  // Group modules by category
  const groupedModules = MODULES.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof MODULES[number][]>);

  const isAdminOrManager = userRole === "admin" || userRole === "manager";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Permissions for {userName}
          </DialogTitle>
          <DialogDescription>
            {isAdminOrManager ? (
              <span className="text-amber-600">
                This user is a {userRole} and has full access to all modules by default.
                These settings will apply if their role changes to "user".
              </span>
            ) : (
              "Configure what this user can view, add, edit, and delete."
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 pb-2 border-b">
              <Button variant="outline" size="sm" onClick={handleGrantAllView}>
                Grant All View
              </Button>
              <Button variant="outline" size="sm" onClick={handleGrantAll}>
                Grant All
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                Clear All
              </Button>
            </div>

            <ScrollArea className="h-[50vh] pr-4">
              <div className="space-y-6">
                {Object.entries(groupedModules).map(([category, modules]) => (
                  <div key={category}>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                      {category}
                    </h3>
                    <div className="space-y-1">
                      {/* Header Row */}
                      <div className="grid grid-cols-[1fr,60px,60px,60px,60px,80px] gap-2 text-xs text-muted-foreground font-medium py-2 border-b">
                        <div>Module</div>
                        <div className="text-center">View</div>
                        <div className="text-center">Add</div>
                        <div className="text-center">Edit</div>
                        <div className="text-center">Delete</div>
                        <div className="text-center">Actions</div>
                      </div>
                      
                      {modules.map((module) => (
                        <div
                          key={module.key}
                          className="grid grid-cols-[1fr,60px,60px,60px,60px,80px] gap-2 items-center py-2 hover:bg-muted/50 rounded-md px-2"
                        >
                          <div className="font-medium text-sm">{module.label}</div>
                          
                          <div className="flex justify-center">
                            <Checkbox
                              checked={permissions[module.key]?.can_view ?? false}
                              onCheckedChange={() => handleToggle(module.key, "can_view")}
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <Checkbox
                              checked={permissions[module.key]?.can_add ?? false}
                              onCheckedChange={() => handleToggle(module.key, "can_add")}
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <Checkbox
                              checked={permissions[module.key]?.can_edit ?? false}
                              onCheckedChange={() => handleToggle(module.key, "can_edit")}
                            />
                          </div>
                          
                          <div className="flex justify-center">
                            <Checkbox
                              checked={permissions[module.key]?.can_delete ?? false}
                              onCheckedChange={() => handleToggle(module.key, "can_delete")}
                            />
                          </div>
                          
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleSelectAllModule(module.key)}
                              title="Select all"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleClearModule(module.key)}
                              title="Clear all"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updatePermissions.isPending}
          >
            {updatePermissions.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
