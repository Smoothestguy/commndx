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
import { useProjects } from "@/integrations/supabase/hooks/useProjects";

const formSchema = z.object({
  project_id: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  log_date: z.string().min(1, "Date is required"),
  temperature_high: z.coerce.number().optional(),
  temperature_low: z.coerce.number().optional(),
  precipitation: z.coerce.number().optional(),
  wind_speed: z.coerce.number().optional(),
  conditions: z.string().optional(),
  work_suitable: z.boolean(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface WeatherLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => void;
  initialData?: Partial<FormData>;
  isLoading?: boolean;
}

export function WeatherLogForm({ open, onOpenChange, onSubmit, initialData, isLoading }: WeatherLogFormProps) {
  const { data: projects } = useProjects();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_id: initialData?.project_id || "",
      location: initialData?.location || "",
      log_date: initialData?.log_date || new Date().toISOString().split("T")[0],
      temperature_high: initialData?.temperature_high,
      temperature_low: initialData?.temperature_low,
      precipitation: initialData?.precipitation,
      wind_speed: initialData?.wind_speed,
      conditions: initialData?.conditions || "",
      work_suitable: initialData?.work_suitable ?? true,
      notes: initialData?.notes || "",
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Weather Conditions</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location *</FormLabel>
                    <FormControl>
                      <Input placeholder="Job site address or city" {...field} />
                    </FormControl>
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
                        {projects?.map((project) => (
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
                name="log_date"
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
                name="conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conditions</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} 
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select conditions" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Not specified</SelectItem>
                        <SelectItem value="sunny">Sunny</SelectItem>
                        <SelectItem value="partly_cloudy">Partly Cloudy</SelectItem>
                        <SelectItem value="cloudy">Cloudy</SelectItem>
                        <SelectItem value="rainy">Rainy</SelectItem>
                        <SelectItem value="stormy">Stormy</SelectItem>
                        <SelectItem value="snowy">Snowy</SelectItem>
                        <SelectItem value="windy">Windy</SelectItem>
                        <SelectItem value="foggy">Foggy</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="temperature_high"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>High (°F)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="temperature_low"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low (°F)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="precipitation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precip (in)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wind_speed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wind (mph)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="work_suitable"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Work Suitable</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Is this weather suitable for roofing work?
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional weather notes..." {...field} />
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
                {isLoading ? "Saving..." : "Log Weather"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
