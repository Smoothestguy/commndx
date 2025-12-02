import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";

const formSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  project_id: z.string().optional(),
  warranty_type: z.enum(["manufacturer", "workmanship", "extended"]),
  provider: z.string().min(1, "Provider is required"),
  coverage_details: z.string().optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  status: z.enum(["active", "expired", "claimed", "voided"]),
  warranty_number: z.string().optional(),
  notifications_enabled: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface WarrantyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => void;
  initialData?: Partial<FormData>;
  isLoading?: boolean;
}

export function WarrantyForm({ open, onOpenChange, onSubmit, initialData, isLoading }: WarrantyFormProps) {
  const { data: customers } = useCustomers();
  const { data: projects } = useProjects();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: initialData?.customer_id || "",
      project_id: initialData?.project_id || "",
      warranty_type: initialData?.warranty_type || "manufacturer",
      provider: initialData?.provider || "",
      coverage_details: initialData?.coverage_details || "",
      start_date: initialData?.start_date || new Date().toISOString().split("T")[0],
      end_date: initialData?.end_date || "",
      status: initialData?.status || "active",
      warranty_number: initialData?.warranty_number || "",
      notifications_enabled: initialData?.notifications_enabled ?? true,
    },
  });

  const selectedCustomerId = form.watch("customer_id");
  const filteredProjects = projects?.filter((p) => p.customer_id === selectedCustomerId) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Warranty" : "New Roof Warranty"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} 
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No project</SelectItem>
                        {filteredProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="warranty_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warranty Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manufacturer">Manufacturer</SelectItem>
                        <SelectItem value="workmanship">Workmanship</SelectItem>
                        <SelectItem value="extended">Extended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., GAF, Owens Corning" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="claimed">Claimed</SelectItem>
                        <SelectItem value="voided">Voided</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="warranty_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warranty Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Certificate or warranty number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coverage_details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coverage Details</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe what the warranty covers..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notifications_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Expiration Notifications</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts before warranty expires
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : initialData ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
