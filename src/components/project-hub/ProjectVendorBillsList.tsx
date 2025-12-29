import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { 
  Receipt, 
  Plus, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  DollarSign,
  AlertTriangle 
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { isPast, isToday } from "date-fns";
import { formatLocalDate, parseLocalDate } from "@/lib/dateUtils";
import { useVendorBills, VendorBill } from "@/integrations/supabase/hooks/useVendorBills";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectVendorBillsListProps {
  projectId: string;
  onAddNew?: () => void;
}

export function ProjectVendorBillsList({ projectId, onAddNew }: ProjectVendorBillsListProps) {
  const navigate = useNavigate();
  const { data: vendorBills, isLoading } = useVendorBills({ project_id: projectId });

  // Calculate summary stats
  const totalBills = vendorBills?.length || 0;
  const totalAmount = vendorBills?.reduce((sum, bill) => sum + bill.total, 0) || 0;
  const totalPaid = vendorBills?.reduce((sum, bill) => sum + (bill.paid_amount || 0), 0) || 0;
  const totalRemaining = totalAmount - totalPaid;
  const overdueBills = vendorBills?.filter(bill => 
    bill.status !== 'paid' && bill.due_date && isPast(parseLocalDate(bill.due_date)) && !isToday(parseLocalDate(bill.due_date))
  ).length || 0;

  const isOverdue = (bill: VendorBill) => {
    return bill.status !== 'paid' && bill.due_date && isPast(parseLocalDate(bill.due_date)) && !isToday(parseLocalDate(bill.due_date));
  };

  return (
    <Card className="glass border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="font-heading flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Vendor Bills ({totalBills})
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Total: {formatCurrency(totalAmount)}</span>
            <span className="text-green-500">Paid: {formatCurrency(totalPaid)}</span>
            <span className="text-orange-500">Outstanding: {formatCurrency(totalRemaining)}</span>
            {overdueBills > 0 && (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueBills} Overdue
              </span>
            )}
          </div>
        </div>
        {onAddNew && (
          <Button size="sm" onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add Bill
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading vendor bills...</div>
        ) : totalBills === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No vendor bills for this project yet.
          </div>
        ) : (
          <div className="space-y-2">
            {vendorBills?.map((bill) => (
              <div
                key={bill.id}
                className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50 ${
                  isOverdue(bill) ? 'border-destructive/50 bg-destructive/5' : 'border-border'
                }`}
                onClick={() => navigate(`/vendor-bills/${bill.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bill.number}</span>
                      <StatusBadge status={bill.status} />
                      {isOverdue(bill) && (
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {bill.vendor_name || 'Unknown Vendor'}
                      {bill.purchase_order_number && (
                        <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded">
                          PO: {bill.purchase_order_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(bill.total)}</div>
                    {bill.paid_amount > 0 && bill.paid_amount < bill.total && (
                      <div className="text-xs text-muted-foreground">
                        Remaining: {formatCurrency(bill.total - bill.paid_amount)}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right text-sm text-muted-foreground min-w-[80px]">
                    <div>Due: {bill.due_date ? formatLocalDate(bill.due_date, 'MMM d') : 'N/A'}</div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/vendor-bills/${bill.id}`);
                      }}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/vendor-bills/${bill.id}/edit`);
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Bill
                      </DropdownMenuItem>
                      {bill.status !== 'paid' && (
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vendor-bills/${bill.id}?recordPayment=true`);
                        }}>
                          <DollarSign className="h-4 w-4 mr-2" />
                          Record Payment
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
