import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Edit, Trash2, DollarSign } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import { format } from "date-fns";

interface VendorBillCardProps {
  bill: VendorBill;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRecordPayment: (id: string) => void;
}

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  partially_paid: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  void: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  partially_paid: "Partial",
  paid: "Paid",
  void: "Void",
};

export function VendorBillCard({ bill, onView, onEdit, onDelete, onRecordPayment }: VendorBillCardProps) {
  const isOverdue = new Date(bill.due_date) < new Date() && bill.status !== "paid" && bill.status !== "void";

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(bill.id)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-foreground">{bill.number}</p>
            <p className="text-sm text-muted-foreground">{bill.vendor_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusStyles[bill.status]}>{statusLabels[bill.status]}</Badge>
            {isOverdue && <Badge variant="destructive">Overdue</Badge>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(bill.id); }}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(bill.id); }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {bill.status !== "paid" && bill.status !== "void" && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRecordPayment(bill.id); }}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Record Payment
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(bill.id); }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Bill Date</p>
            <p className="font-medium">{format(new Date(bill.bill_date), "MMM d, yyyy")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Due Date</p>
            <p className={`font-medium ${isOverdue ? "text-destructive" : ""}`}>
              {format(new Date(bill.due_date), "MMM d, yyyy")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold">${Number(bill.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Remaining</p>
            <p className="font-semibold text-orange-600 dark:text-orange-400">
              ${Number(bill.remaining_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
