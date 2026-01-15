import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SecureAvatar } from "@/components/ui/secure-avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { usePersonnelByVendor, usePersonnel, useAssignPersonnelToVendor } from "@/integrations/supabase/hooks/usePersonnel";

interface VendorPersonnelSectionProps {
  vendorId: string;
  vendorName: string;
}

export const VendorPersonnelSection = ({ vendorId, vendorName }: VendorPersonnelSectionProps) => {
  const navigate = useNavigate();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [personnelToRemove, setPersonnelToRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: vendorPersonnel, isLoading } = usePersonnelByVendor(vendorId);
  const { data: allPersonnel } = usePersonnel({ status: "active" });
  const assignMutation = useAssignPersonnelToVendor();

  // Filter personnel not already assigned to this vendor
  const availablePersonnel = allPersonnel?.filter(
    (p) => !p.vendor_id || p.vendor_id !== vendorId
  );

  const handleAssignPersonnel = () => {
    if (!selectedPersonnelId) return;
    
    assignMutation.mutate(
      { personnelId: selectedPersonnelId, vendorId },
      {
        onSuccess: () => {
          setAddDialogOpen(false);
          setSelectedPersonnelId(null);
        },
      }
    );
  };

  const handleRemovePersonnel = () => {
    if (!personnelToRemove) return;
    
    assignMutation.mutate(
      { personnelId: personnelToRemove.id, vendorId: null },
      {
        onSuccess: () => {
          setRemoveDialogOpen(false);
          setPersonnelToRemove(null);
        },
      }
    );
  };

  const openRemoveDialog = (id: string, firstName: string, lastName: string) => {
    setPersonnelToRemove({ id, name: `${firstName} ${lastName}` });
    setRemoveDialogOpen(true);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "inactive":
        return "bg-muted text-muted-foreground";
      case "do_not_hire":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Personnel
            </CardTitle>
            <CardDescription>
              {vendorPersonnel?.length || 0} personnel assigned to {vendorName}
            </CardDescription>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Personnel
          </Button>
        </CardHeader>
        <CardContent>
          {vendorPersonnel && vendorPersonnel.length > 0 ? (
            <div className="space-y-3">
              {vendorPersonnel.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => navigate(`/personnel/${person.id}`)}
                  >
                    <SecureAvatar
                      bucket="personnel-photos"
                      photoUrl={person.photo_url}
                      className="h-10 w-10"
                      fallback={
                        <span>
                          {person.first_name?.[0]}
                          {person.last_name?.[0]}
                        </span>
                      }
                      alt={`${person.first_name} ${person.last_name}`}
                    />
                    <div>
                      <p className="font-medium">
                        {person.first_name} {person.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {person.email}
                      </p>
                    </div>
                    <Badge className={getStatusColor(person.status)}>
                      {person.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openRemoveDialog(person.id, person.first_name, person.last_name)}
                  >
                    <UserMinus className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No personnel assigned to this vendor
              </p>
              <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Personnel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Personnel Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Personnel to {vendorName}</DialogTitle>
            <DialogDescription>
              Select a personnel member to assign to this vendor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedPersonnelId || ""} onValueChange={setSelectedPersonnelId}>
              <SelectTrigger>
                <SelectValue placeholder="Select personnel..." />
              </SelectTrigger>
              <SelectContent>
                {availablePersonnel?.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.first_name} {person.last_name} - {person.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availablePersonnel?.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No available personnel to assign. All active personnel are already assigned to vendors.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignPersonnel} 
              disabled={!selectedPersonnelId || assignMutation.isPending}
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Personnel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Personnel Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Personnel from Vendor</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {personnelToRemove?.name} from {vendorName}?
              This will unlink them from the vendor but not delete the personnel record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRemovePersonnel}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? "Removing..." : "Remove Personnel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
