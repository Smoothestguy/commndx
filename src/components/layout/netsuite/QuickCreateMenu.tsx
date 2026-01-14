import { Link } from "react-router-dom";
import { Plus, FileText, Receipt, ShoppingCart, Users, FolderKanban, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const quickCreateItems = [
  { name: "New Estimate", href: "/estimates/new", icon: FileText },
  { name: "New Invoice", href: "/invoices/new", icon: Receipt },
  { name: "New Purchase Order", href: "/purchase-orders/new", icon: ShoppingCart },
  { name: "New Vendor Bill", href: "/vendor-bills/new", icon: Receipt },
];

export function QuickCreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-header-foreground hover:bg-white/10"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {quickCreateItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link to={item.href} className="flex items-center gap-2">
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
