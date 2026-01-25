import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssets, useCreateAsset } from "@/integrations/supabase/hooks/useAssets";
import { useAssignAsset } from "@/integrations/supabase/hooks/useAssetAssignments";
import { usePersonnelByProject } from "@/integrations/supabase/hooks/usePersonnelProjectAssignments";

const assignmentSchema = z.object({
  assetId: z.string().min(1, "Please select an asset"),
  personnelId: z.string().optional(),
  startAt: z.date(),
  endAt: z.date().optional(),
  notes: z.string().optional(),
});

const newAssetSchema = z.object({
  type: z.string().min(1, "Please select a type"),
  label: z.string().min(1, "Label is required"),
  serialNumber: z.string().optional(),
  address: z.string().optional(),
  instructions: z.string().optional(),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;
type NewAssetFormValues = z.infer<typeof newAssetSchema>;

interface AssignAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const assetTypes = [
  { value: "vehicle", label: "Vehicle" },
  { value: "equipment", label: "Equipment" },
  { value: "key", label: "Key/Badge" },
  { value: "location", label: "Location" },
  { value: "tool", label: "Tool" },
  { value: "other", label: "Other" },
];

export function AssignAssetDialog({ 
  open, 
  onOpenChange, 
  projectId 
}: AssignAssetDialogProps) {
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);
  
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: personnel = [] } = usePersonnelByProject(projectId);
  const createAssetMutation = useCreateAsset();
  const assignMutation = useAssignAsset();

  const availableAssets = assets.filter(a => a.status === "available" || a.status === "assigned");

  const assignmentForm = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      assetId: "",
      personnelId: "",
      startAt: new Date(),
      notes: "",
    },
  });

  const newAssetForm = useForm<NewAssetFormValues>({
    resolver: zodResolver(newAssetSchema),
    defaultValues: {
      type: "",
      label: "",
      serialNumber: "",
      address: "",
      instructions: "",
    },
  });

  const handleCreateAsset = async (values: NewAssetFormValues) => {
    const asset = await createAssetMutation.mutateAsync({
      type: values.type,
      label: values.label,
      serial_number: values.serialNumber || null,
      address: values.address || null,
      instructions: values.instructions || null,
      status: "available",
    });
    
    setCreatedAssetId(asset.id);
    assignmentForm.setValue("assetId", asset.id);
    setActiveTab("existing");
  };

  const handleAssign = async (values: AssignmentFormValues) => {
    await assignMutation.mutateAsync({
      projectId: projectId,
      assetId: values.assetId,
      personnelId: values.personnelId || undefined,
      startAt: values.startAt.toISOString(),
      endAt: values.endAt?.toISOString(),
      notes: values.notes,
    });
    
    onOpenChange(false);
    assignmentForm.reset();
    newAssetForm.reset();
    setCreatedAssetId(null);
  };

  const isSubmitting = createAssetMutation.isPending || assignMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Asset to Project</DialogTitle>
          <DialogDescription>
            Select an existing asset or create a new one to assign to this project.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "existing" | "new")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Asset</TabsTrigger>
            <TabsTrigger value="new">Create New</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-4">
            <Form {...assignmentForm}>
              <form onSubmit={assignmentForm.handleSubmit(handleAssign)} className="space-y-4">
                <FormField
                  control={assignmentForm.control}
                  name="assetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an asset" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assetsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : availableAssets.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">
                              No assets available
                            </div>
                          ) : (
                            availableAssets.map((asset) => (
                              <SelectItem key={asset.id} value={asset.id}>
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  <span>{asset.label}</span>
                                  <span className="text-muted-foreground capitalize">
                                    ({asset.type})
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={assignmentForm.control}
                  name="personnelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Personnel (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Project-wide (no specific person)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Project-wide</SelectItem>
                          {personnel
                            .filter(p => p.personnel)
                            .map((assignment) => (
                              <SelectItem 
                                key={assignment.personnel_id} 
                                value={assignment.personnel_id}
                              >
                                {assignment.personnel?.first_name} {assignment.personnel?.last_name}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={assignmentForm.control}
                    name="startAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={assignmentForm.control}
                    name="endAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date (Optional)</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>No end date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={assignmentForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any special instructions or notes..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      "Assign Asset"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="new" className="mt-4">
            <Form {...newAssetForm}>
              <form onSubmit={newAssetForm.handleSubmit(handleCreateAsset)} className="space-y-4">
                <FormField
                  control={newAssetForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assetTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newAssetForm.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label / Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Truck #42, Gate Key A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newAssetForm.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Serial number or ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newAssetForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address / Location (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Location or address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={newAssetForm.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Operating instructions or notes..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createAssetMutation.isPending}>
                    {createAssetMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create & Continue
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
