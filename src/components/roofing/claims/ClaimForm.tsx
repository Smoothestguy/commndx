import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/integrations/supabase/hooks/useCustomers";
import { useProjects } from "@/integrations/supabase/hooks/useProjects";
import { useCreateInsuranceClaim, useUpdateInsuranceClaim } from "@/integrations/supabase/hooks/useInsuranceClaims";
import type { InsuranceClaim, ClaimStatus } from "@/types/roofing";

const claimSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  project_id: z.string().optional(),
  claim_number: z.string().optional(),
  insurance_company: z.string().min(1, "Insurance company is required"),
  policy_number: z.string().optional(),
  adjuster_name: z.string().optional(),
  adjuster_phone: z.string().optional(),
  adjuster_email: z.string().email().optional().or(z.literal("")),
  date_of_loss: z.string().min(1, "Date of loss is required"),
  damage_description: z.string().optional(),
  status: z.enum(["filed", "pending_adjuster", "adjuster_scheduled", "approved", "denied", "in_progress", "completed"]),
  filed_date: z.string().optional(),
  adjuster_visit_date: z.string().optional(),
  approved_amount: z.string().optional(),
  deductible: z.string().optional(),
  notes: z.string().optional(),
});

type ClaimFormData = z.infer<typeof claimSchema>;

interface ClaimFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim?: InsuranceClaim;
}

const statuses: { value: ClaimStatus; label: string }[] = [
  { value: "filed", label: "Filed" },
  { value: "pending_adjuster", label: "Pending Adjuster" },
  { value: "adjuster_scheduled", label: "Adjuster Scheduled" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export function ClaimForm({ open, onOpenChange, claim }: ClaimFormProps) {
  const { data: customers } = useCustomers();
  const { data: projects } = useProjects();
  const createClaim = useCreateInsuranceClaim();
  const updateClaim = useUpdateInsuranceClaim();

  const form = useForm<ClaimFormData>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      customer_id: claim?.customer_id || "",
      project_id: claim?.project_id || "",
      claim_number: claim?.claim_number || "",
      insurance_company: claim?.insurance_company || "",
      policy_number: claim?.policy_number || "",
      adjuster_name: claim?.adjuster_name || "",
      adjuster_phone: claim?.adjuster_phone || "",
      adjuster_email: claim?.adjuster_email || "",
      date_of_loss: claim?.date_of_loss || "",
      damage_description: claim?.damage_description || "",
      status: claim?.status || "filed",
      filed_date: claim?.filed_date || "",
      adjuster_visit_date: claim?.adjuster_visit_date || "",
      approved_amount: claim?.approved_amount?.toString() || "",
      deductible: claim?.deductible?.toString() || "",
      notes: claim?.notes || "",
    },
  });

  const selectedCustomerId = form.watch("customer_id");
  const filteredProjects = projects?.filter(p => p.customer_id === selectedCustomerId);

  const onSubmit = async (data: ClaimFormData) => {
    try {
      const payload = {
        ...data,
        approved_amount: data.approved_amount ? parseFloat(data.approved_amount) : undefined,
        deductible: data.deductible ? parseFloat(data.deductible) : undefined,
        adjuster_email: data.adjuster_email || undefined,
      };

      if (claim) {
        await updateClaim.mutateAsync({ id: claim.id, ...payload });
      } else {
        await createClaim.mutateAsync(payload as any);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{claim ? "Edit Insurance Claim" : "New Insurance Claim"}</DialogTitle>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredProjects?.map((project) => (
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
                name="insurance_company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance Company *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., State Farm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="claim_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Claim Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Claim #" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="policy_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Policy #" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_of_loss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Loss *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Adjuster Information</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="adjuster_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adjuster Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adjuster_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adjuster_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="Email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
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
                name="approved_amount"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Approved Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input type="number" step="0.01" {...field} placeholder="0.00" className="pl-7" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deductible"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Deductible</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input type="number" step="0.01" {...field} placeholder="0.00" className="pl-7" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="filed_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filed Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adjuster_visit_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adjuster Visit Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="damage_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Damage Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describe the damage..." rows={3} />
                  </FormControl>
                  <FormMessage />
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
                    <Textarea {...field} placeholder="Internal notes..." rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createClaim.isPending || updateClaim.isPending}>
                {claim ? "Update" : "Create Claim"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
