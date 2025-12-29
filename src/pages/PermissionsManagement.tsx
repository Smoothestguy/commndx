import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Shield, Save, Users, Loader2, CheckSquare, XSquare, Info, Eye, DollarSign } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissionCheck } from "@/hooks/usePermissionCheck";
import { useUserPermissions, useUpdateUserPermissions, MODULES, type ModuleKey } from "@/integrations/supabase/hooks/useUserPermissions";
import { useSensitivePermissions, useUpdateSensitivePermissions, SENSITIVE_PERMISSIONS, type SensitivePermissionKey } from "@/integrations/supabase/hooks/useSensitivePermissions";
import { Navigate, Link } from "react-router-dom";

interface Profile {
  id: string;
  email: string | null;
}

interface UserWithRole extends Profile {
  role: string | null;
}

type PermissionType = "can_view" | "can_add" | "can_edit" | "can_delete";

type PermissionState = Record<string, Record<PermissionType, boolean>>;

type SensitivePermissionState = Record<SensitivePermissionKey, boolean>;

// Role presets configuration
const ROLE_PRESETS = {
  admin: {
    label: "Admin (Full Access)",
    description: "All permissions on all modules",
    permissions: MODULES.reduce((acc, mod) => {
      acc[mod.key] = { can_view: true, can_add: true, can_edit: true, can_delete: true };
      return acc;
    }, {} as PermissionState),
  },
  manager: {
    label: "Manager",
    description: "Full access to all modules",
    permissions: MODULES.reduce((acc, mod) => {
      acc[mod.key] = { can_view: true, can_add: true, can_edit: true, can_delete: true };
      return acc;
    }, {} as PermissionState),
  },
  contractor: {
    label: "Contractor/Vendor",
    description: "View-only on Projects",
    permissions: MODULES.reduce((acc, mod) => {
      if (mod.key === "projects") {
        acc[mod.key] = { can_view: true, can_add: false, can_edit: false, can_delete: false };
      } else {
        acc[mod.key] = { can_view: false, can_add: false, can_edit: false, can_delete: false };
      }
      return acc;
    }, {} as PermissionState),
  },
  personnel: {
    label: "Personnel",
    description: "View/Edit on Time Tracking",
    permissions: MODULES.reduce((acc, mod) => {
      if (mod.key === "time_tracking") {
        acc[mod.key] = { can_view: true, can_add: true, can_edit: true, can_delete: false };
      } else {
        acc[mod.key] = { can_view: false, can_add: false, can_edit: false, can_delete: false };
      }
      return acc;
    }, {} as PermissionState),
  },
  accounting: {
    label: "Accounting",
    description: "Invoices, Vendor Bills, Purchase Orders",
    permissions: MODULES.reduce((acc, mod) => {
      if (["invoices", "purchase_orders"].includes(mod.key)) {
        acc[mod.key] = { can_view: true, can_add: true, can_edit: true, can_delete: false };
      } else if (mod.key === "vendors") {
        acc[mod.key] = { can_view: true, can_add: false, can_edit: false, can_delete: false };
      } else {
        acc[mod.key] = { can_view: false, can_add: false, can_edit: false, can_delete: false };
      }
      return acc;
    }, {} as PermissionState),
  },
};

const getEmptyPermissions = (): PermissionState => {
  return MODULES.reduce((acc, mod) => {
    acc[mod.key] = { can_view: false, can_add: false, can_edit: false, can_delete: false };
    return acc;
  }, {} as PermissionState);
};

const getEmptySensitivePermissions = (): SensitivePermissionState => ({
  can_view_billing_rates: false,
  can_view_cost_rates: false,
  can_view_margins: false,
  can_view_personnel_pay_rates: false,
});

export default function PermissionsManagement() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { canView, canEdit, loading: permLoading } = usePermissionCheck('permissions_management');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionState>(getEmptyPermissions());
  const [sensitivePermissions, setSensitivePermissions] = useState<SensitivePermissionState>(getEmptySensitivePermissions());
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch all users with their roles
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email")
        .order("email");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      return (profiles || []).map(p => ({
        ...p,
        role: rolesMap.get(p.id) || null,
      })) as UserWithRole[];
    },
  });

  const { data: userPermissions, isLoading: permissionsLoading } = useUserPermissions(selectedUserId || undefined);
  const { data: userSensitivePermissions, isLoading: sensitiveLoading } = useSensitivePermissions(selectedUserId || undefined);
  const updatePermissions = useUpdateUserPermissions();
  const updateSensitivePermissions = useUpdateSensitivePermissions();

  // Helper to get full permissions (all checked)
  const getFullPermissions = (): PermissionState => {
    return MODULES.reduce((acc, mod) => {
      acc[mod.key] = { can_view: true, can_add: true, can_edit: true, can_delete: true };
      return acc;
    }, {} as PermissionState);
  };

  // Helper to get full sensitive permissions (all checked)
  const getFullSensitivePermissions = (): SensitivePermissionState => ({
    can_view_billing_rates: true,
    can_view_cost_rates: true,
    can_view_margins: true,
    can_view_personnel_pay_rates: true,
  });

  // Check if selected user has role-based access (admin/manager)
  const selectedUserRole = users?.find(u => u.id === selectedUserId)?.role;
  const isRoleBasedAccess = selectedUserRole === 'admin' || selectedUserRole === 'manager';

  // Update local state when user permissions are loaded
  useEffect(() => {
    if (selectedUserId) {
      const userRole = users?.find(u => u.id === selectedUserId)?.role;
      
      // Admins and managers have full access - show all permissions checked
      if (userRole === 'admin' || userRole === 'manager') {
        setPermissions(getFullPermissions());
        setSensitivePermissions(getFullSensitivePermissions());
        setHasChanges(false);
        return;
      }
      
      // Regular users - load from user_permissions table
      if (userPermissions) {
        const newPermissions = getEmptyPermissions();
        userPermissions.forEach(p => {
          if (newPermissions[p.module]) {
            newPermissions[p.module] = {
              can_view: p.can_view,
              can_add: p.can_add,
              can_edit: p.can_edit,
              can_delete: p.can_delete,
            };
          }
        });
        setPermissions(newPermissions);
        setHasChanges(false);
      }
    }
  }, [userPermissions, selectedUserId, users]);

  // Update sensitive permissions when loaded (only for non-admin/manager users)
  useEffect(() => {
    if (selectedUserId) {
      const userRole = users?.find(u => u.id === selectedUserId)?.role;
      
      // Skip for admin/manager - already handled above
      if (userRole === 'admin' || userRole === 'manager') {
        return;
      }
      
      if (userSensitivePermissions) {
        setSensitivePermissions({
          can_view_billing_rates: userSensitivePermissions.can_view_billing_rates,
          can_view_cost_rates: userSensitivePermissions.can_view_cost_rates,
          can_view_margins: userSensitivePermissions.can_view_margins,
          can_view_personnel_pay_rates: userSensitivePermissions.can_view_personnel_pay_rates,
        });
      } else {
        setSensitivePermissions(getEmptySensitivePermissions());
      }
    }
  }, [userSensitivePermissions, selectedUserId, users]);

  // Group modules by category
  const groupedModules = useMemo(() => {
    const groups: Record<string, typeof MODULES[number][]> = {};
    MODULES.forEach(mod => {
      if (!groups[mod.category]) groups[mod.category] = [];
      groups[mod.category].push(mod);
    });
    return groups;
  }, []);

  const handleToggle = (moduleKey: string, permType: PermissionType) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [permType]: !prev[moduleKey][permType],
      },
    }));
    setHasChanges(true);
  };

  const handleSensitiveToggle = (key: SensitivePermissionKey) => {
    setSensitivePermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    setHasChanges(true);
  };

  const applyPreset = (presetKey: keyof typeof ROLE_PRESETS) => {
    setPermissions({ ...ROLE_PRESETS[presetKey].permissions });
    setHasChanges(true);
    toast.info(`Applied "${ROLE_PRESETS[presetKey].label}" preset`);
  };

  const handleSelectAllModule = (moduleKey: string) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { can_view: true, can_add: true, can_edit: true, can_delete: true },
    }));
    setHasChanges(true);
  };

  const handleClearModule = (moduleKey: string) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { can_view: false, can_add: false, can_edit: false, can_delete: false },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedUserId) return;

    const permissionsArray = Object.entries(permissions).map(([module, perms]) => ({
      module,
      ...perms,
    }));

    // Save module permissions
    updatePermissions.mutate(
      { userId: selectedUserId, permissions: permissionsArray },
      {
        onSuccess: () => {
          // Also save sensitive permissions
          updateSensitivePermissions.mutate(
            { userId: selectedUserId, permissions: sensitivePermissions },
            {
              onSuccess: () => {
                setHasChanges(false);
                toast.success("All permissions saved successfully");
              },
            }
          );
        },
      }
    );
  };

  const selectedUser = users?.find(u => u.id === selectedUserId);

  if (roleLoading || permLoading) {
    return (
      <PageLayout title="Permissions Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  // Allow access if admin OR has view permission
  const hasAccess = isAdmin || canView;
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }
  
  // Determine if user can edit permissions (admin or has edit permission)
  const canEditPermissions = isAdmin || canEdit;

  const getPermissionTooltip = (mod: typeof MODULES[number], permType: PermissionType): string => {
    if (mod.permissions && mod.permissions[permType]) {
      return mod.permissions[permType];
    }
    const labels: Record<PermissionType, string> = {
      can_view: "View records",
      can_add: "Create new records",
      can_edit: "Edit existing records",
      can_delete: "Delete records",
    };
    return labels[permType];
  };

  return (
    <TooltipProvider>
      <PageLayout
        title="Permissions Management"
        description="Configure user access controls for each module"
      >
        <div className="space-y-6">
          {/* User Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select User
              </CardTitle>
              <CardDescription>Choose a user to configure their permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select value={selectedUserId || ""} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usersLoading ? (
                      <div className="p-2 text-center text-muted-foreground">Loading...</div>
                    ) : (
                      users?.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <span>{user.email || "Unknown"}</span>
                            {user.role && (
                              <Badge variant="outline" className="text-xs">
                                {user.role}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {selectedUser && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Current role:</span>
                    <Badge variant={selectedUser.role === "admin" ? "default" : "secondary"}>
                      {selectedUser.role || "No role"}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedUserId && (
            <>
              {/* Role-Based Access Alert */}
              {isRoleBasedAccess && (
                <Alert className="border-primary/50 bg-primary/5">
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Role-Based Access</AlertTitle>
                  <AlertDescription>
                    This user has full access to all modules because they are a <span className="font-semibold">{selectedUserRole}</span>. 
                    These permissions are granted automatically by their role. To modify their access, change their role in{" "}
                    <Link to="/user-management" className="font-medium text-primary hover:underline">
                      User Management
                    </Link>.
                  </AlertDescription>
                </Alert>
              )}

              {/* Role Presets - Only show for non-admin/manager users */}
              {!isRoleBasedAccess && (
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Presets</CardTitle>
                    <CardDescription>Apply a predefined permission template</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          onClick={() => applyPreset(key as keyof typeof ROLE_PRESETS)}
                          className="flex flex-col items-start h-auto py-2 px-3"
                        >
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-xs text-muted-foreground">{preset.description}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sensitive Data Access */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Sensitive Data Access
                  </CardTitle>
                  <CardDescription>
                    Control access to financial and rate information. These settings apply across all modules.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sensitiveLoading ? (
                    <div className="flex items-center justify-center h-20">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {SENSITIVE_PERMISSIONS.map((perm) => (
                        <div
                          key={perm.key}
                          className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            id={perm.key}
                            checked={sensitivePermissions[perm.key]}
                            onCheckedChange={() => handleSensitiveToggle(perm.key)}
                            disabled={isRoleBasedAccess}
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={perm.key}
                              className="text-sm font-medium cursor-pointer flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4 text-muted-foreground" />
                              {perm.label}
                            </label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {perm.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Permissions Matrix */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Module Permissions</CardTitle>
                    <CardDescription>
                      Configure which modules {selectedUser?.email} can access
                    </CardDescription>
                  </div>
                  {!isRoleBasedAccess && (
                    <Button onClick={handleSave} disabled={!hasChanges || updatePermissions.isPending}>
                      {updatePermissions.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save All Permissions
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {permissionsLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[200px]">Module</TableHead>
                            <TableHead className="text-center w-[80px]">
                              <Tooltip>
                                <TooltipTrigger className="flex items-center justify-center gap-1 w-full">
                                  View <Info className="h-3 w-3" />
                                </TooltipTrigger>
                                <TooltipContent>Can see this module and its data</TooltipContent>
                              </Tooltip>
                            </TableHead>
                            <TableHead className="text-center w-[80px]">
                              <Tooltip>
                                <TooltipTrigger className="flex items-center justify-center gap-1 w-full">
                                  Create <Info className="h-3 w-3" />
                                </TooltipTrigger>
                                <TooltipContent>Can create new records</TooltipContent>
                              </Tooltip>
                            </TableHead>
                            <TableHead className="text-center w-[80px]">
                              <Tooltip>
                                <TooltipTrigger className="flex items-center justify-center gap-1 w-full">
                                  Edit <Info className="h-3 w-3" />
                                </TooltipTrigger>
                                <TooltipContent>Can modify existing records</TooltipContent>
                              </Tooltip>
                            </TableHead>
                            <TableHead className="text-center w-[80px]">
                              <Tooltip>
                                <TooltipTrigger className="flex items-center justify-center gap-1 w-full">
                                  Delete <Info className="h-3 w-3" />
                                </TooltipTrigger>
                                <TooltipContent>Can remove records permanently</TooltipContent>
                              </Tooltip>
                            </TableHead>
                            <TableHead className="text-center w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(groupedModules).map(([category, modules]) => (
                            <>
                              <TableRow key={`cat-${category}`} className="bg-muted/30">
                                <TableCell colSpan={6} className="font-semibold text-sm py-2">
                                  {category}
                                </TableCell>
                              </TableRow>
                              {modules.map(mod => (
                                <TableRow key={mod.key}>
                                  <TableCell className="font-medium pl-6">
                                    <Tooltip>
                                      <TooltipTrigger className="flex items-center gap-1.5 text-left">
                                        {mod.label}
                                        {mod.description && <Info className="h-3 w-3 text-muted-foreground" />}
                                      </TooltipTrigger>
                                      {mod.description && (
                                        <TooltipContent side="right" className="max-w-[200px]">
                                          {mod.description}
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={permissions[mod.key as ModuleKey]?.can_view || false}
                                            onCheckedChange={() => handleToggle(mod.key as ModuleKey, "can_view")}
                                            disabled={isRoleBasedAccess}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>{getPermissionTooltip(mod, "can_view")}</TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={permissions[mod.key as ModuleKey]?.can_add || false}
                                            onCheckedChange={() => handleToggle(mod.key as ModuleKey, "can_add")}
                                            disabled={isRoleBasedAccess}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>{getPermissionTooltip(mod, "can_add")}</TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={permissions[mod.key as ModuleKey]?.can_edit || false}
                                            onCheckedChange={() => handleToggle(mod.key as ModuleKey, "can_edit")}
                                            disabled={isRoleBasedAccess}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>{getPermissionTooltip(mod, "can_edit")}</TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex justify-center">
                                          <Checkbox
                                            checked={permissions[mod.key as ModuleKey]?.can_delete || false}
                                            onCheckedChange={() => handleToggle(mod.key as ModuleKey, "can_delete")}
                                            disabled={isRoleBasedAccess}
                                          />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>{getPermissionTooltip(mod, "can_delete")}</TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {!isRoleBasedAccess && (
                                      <div className="flex items-center justify-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => handleSelectAllModule(mod.key as ModuleKey)}
                                          title="Select all"
                                        >
                                          <CheckSquare className="h-4 w-4 text-green-600" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => handleClearModule(mod.key as ModuleKey)}
                                          title="Clear all"
                                        >
                                          <XSquare className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </PageLayout>
    </TooltipProvider>
  );
}
