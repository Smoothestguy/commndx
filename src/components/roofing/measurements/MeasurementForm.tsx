import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  project_id: z.string().optional(),
  measurement_date: z.string().min(1, "Date is required"),
  // Area measurements
  total_roof_area: z.coerce.number().optional(),
  total_pitched_area: z.coerce.number().optional(),
  total_flat_area: z.coerce.number().optional(),
  total_facets: z.coerce.number().int().optional(),
  total_squares: z.coerce.number().optional(),
  pitch: z.string().optional(),
  roof_type: z.enum(["gable", "hip", "flat", "mansard", "gambrel", "shed", "combination"]).optional(),
  // Linear measurements
  eaves_length: z.coerce.number().optional(),
  valleys_length: z.coerce.number().optional(),
  hips_length: z.coerce.number().optional(),
  ridges_length: z.coerce.number().optional(),
  rakes_length: z.coerce.number().optional(),
  wall_flashing_length: z.coerce.number().optional(),
  step_flashing_length: z.coerce.number().optional(),
  transitions_length: z.coerce.number().optional(),
  parapet_wall_length: z.coerce.number().optional(),
  unspecified_length: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface MeasurementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => void;
  initialData?: Partial<FormData>;
  isLoading?: boolean;
}

export function MeasurementForm({ open, onOpenChange, onSubmit, initialData, isLoading }: MeasurementFormProps) {
  const { data: customers } = useCustomers();
  const { data: projects } = useProjects();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: initialData?.customer_id || "",
      project_id: initialData?.project_id || "",
      measurement_date: initialData?.measurement_date || new Date().toISOString().split("T")[0],
      total_roof_area: initialData?.total_roof_area,
      total_pitched_area: initialData?.total_pitched_area,
      total_flat_area: initialData?.total_flat_area,
      total_facets: initialData?.total_facets,
      total_squares: initialData?.total_squares,
      pitch: initialData?.pitch || "",
      roof_type: initialData?.roof_type,
      eaves_length: initialData?.eaves_length,
      valleys_length: initialData?.valleys_length,
      hips_length: initialData?.hips_length,
      ridges_length: initialData?.ridges_length,
      rakes_length: initialData?.rakes_length,
      wall_flashing_length: initialData?.wall_flashing_length,
      step_flashing_length: initialData?.step_flashing_length,
      transitions_length: initialData?.transitions_length,
      parapet_wall_length: initialData?.parapet_wall_length,
      unspecified_length: initialData?.unspecified_length,
      notes: initialData?.notes || "",
    },
  });

  const selectedCustomerId = form.watch("customer_id");
  const filteredProjects = projects?.filter((p) => p.customer_id === selectedCustomerId) || [];

  // Calculate derived values
  const hipsLength = form.watch("hips_length") || 0;
  const ridgesLength = form.watch("ridges_length") || 0;
  const eavesLength = form.watch("eaves_length") || 0;
  const rakesLength = form.watch("rakes_length") || 0;
  const hipsRidges = hipsLength + ridgesLength;
  const eavesRakes = eavesLength + rakesLength;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Measurement" : "New Roof Measurement"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="measurement_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roof_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Roof Type</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "__none__" ? undefined : val)} 
                          value={field.value || "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Not specified</SelectItem>
                            <SelectItem value="gable">Gable</SelectItem>
                            <SelectItem value="hip">Hip</SelectItem>
                            <SelectItem value="flat">Flat</SelectItem>
                            <SelectItem value="mansard">Mansard</SelectItem>
                            <SelectItem value="gambrel">Gambrel</SelectItem>
                            <SelectItem value="shed">Shed</SelectItem>
                            <SelectItem value="combination">Combination</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pitch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Predominant Pitch</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 8/12" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Area Measurements */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Area Measurements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="total_roof_area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Roof Area</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="sqft" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="total_pitched_area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pitched Area</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="sqft" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="total_flat_area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flat Area</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="sqft" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="total_facets"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Facets</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="count" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="total_squares"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Roofing Squares</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="squares" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Linear Measurements */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Linear Measurements (ft)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="eaves_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Eaves</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valleys_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Valleys</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hips_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Hips</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ridges_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Ridges</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rakes_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Rakes</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  <FormField
                    control={form.control}
                    name="wall_flashing_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Wall Flashing</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="step_flashing_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Step Flashing</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transitions_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transitions</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="parapet_wall_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parapet Wall</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unspecified_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unspecified</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Calculated Fields */}
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Hips + Ridges</p>
                    <p className="text-lg font-semibold">{hipsRidges.toFixed(2)} ft</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Eaves + Rakes</p>
                    <p className="text-lg font-semibold">{eavesRakes.toFixed(2)} ft</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional measurement notes..." {...field} />
                  </FormControl>
                  <FormMessage />
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
