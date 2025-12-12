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
import { toast } from "sonner";
import { Shield, Save, Users, Loader2, CheckSquare, XSquare } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserPermissions, useUpdateUserPermissions, MODULES, type ModuleKey } from "@/integrations/supabase/hooks/useUserPermissions";
import { Navigate } from "react-router-dom";

interface Profile {
  id: string;
  email: string | null;
}

interface UserWithRole extends Profile {
  role: string | null;
}

type PermissionType = "can_view" | "can_add" | "can_edit" | "can_delete";

type PermissionState = Record<string, Record<PermissionType, boolean>>;

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

export default function PermissionsManagement() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionState>(getEmptyPermissions());
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
  const updatePermissions = useUpdateUserPermissions();

  // Update local state when user permissions are loaded
  useEffect(() => {
    if (userPermissions && selectedUserId) {
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
  }, [userPermissions, selectedUserId]);

  // Group modules by category
  const groupedModules = useMemo(() => {
    const groups: Record<string, Array<{ key: string; label: string; category: string }>> = {};
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

  const handleSave = () => {
    if (!selectedUserId) return;

    const permissionsArray = Object.entries(permissions).map(([module, perms]) => ({
      module,
      ...perms,
    }));

    updatePermissions.mutate(
      { userId: selectedUserId, permissions: permissionsArray },
      {
        onSuccess: () => setHasChanges(false),
      }
    );
  };

  const selectedUser = users?.find(u => u.id === selectedUserId);

  if (roleLoading) {
    return (
      <PageLayout title="Permissions Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
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
            {/* Role Presets */}
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

            {/* Permissions Matrix */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Permission Matrix</CardTitle>
                  <CardDescription>
                    Configure individual permissions for {selectedUser?.email}
                  </CardDescription>
                </div>
                <Button onClick={handleSave} disabled={!hasChanges || updatePermissions.isPending}>
                  {updatePermissions.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Permissions
                </Button>
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
                          <TableHead className="text-center w-[80px]">View</TableHead>
                          <TableHead className="text-center w-[80px]">Create</TableHead>
                          <TableHead className="text-center w-[80px]">Edit</TableHead>
                          <TableHead className="text-center w-[80px]">Delete</TableHead>
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
                                <TableCell className="font-medium pl-6">{mod.label}</TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={permissions[mod.key as ModuleKey]?.can_view || false}
                                    onCheckedChange={() => handleToggle(mod.key as ModuleKey, "can_view")}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={permissions[mod.key as ModuleKey]?.can_add || false}
                                    onCheckedChange={() => handleToggle(mod.key as ModuleKey, "can_add")}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={permissions[mod.key as ModuleKey]?.can_edit || false}
                                    onCheckedChange={() => handleToggle(mod.key as ModuleKey, "can_edit")}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={permissions[mod.key as ModuleKey]?.can_delete || false}
                                    onCheckedChange={() => handleToggle(mod.key as ModuleKey, "can_delete")}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
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
  );
}
