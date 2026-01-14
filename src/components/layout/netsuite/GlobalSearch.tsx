import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const searchCategories = [
  {
    title: "Pages",
    items: [
      { name: "Dashboard", href: "/" },
      { name: "Estimates", href: "/estimates" },
      { name: "Invoices", href: "/invoices" },
      { name: "Purchase Orders", href: "/purchase-orders" },
      { name: "Vendor Bills", href: "/vendor-bills" },
      { name: "Customers", href: "/customers" },
      { name: "Vendors", href: "/vendors" },
      { name: "Personnel", href: "/personnel" },
      { name: "Products", href: "/products" },
      { name: "Projects", href: "/projects" },
      { name: "Time Tracking", href: "/time-tracking" },
      { name: "Settings", href: "/settings" },
    ],
  },
  {
    title: "Actions",
    items: [
      { name: "Create Estimate", href: "/estimates/new" },
      { name: "Create Invoice", href: "/invoices/new" },
      { name: "Create Purchase Order", href: "/purchase-orders/new" },
      { name: "Create Vendor Bill", href: "/vendor-bills/new" },
    ],
  },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleSelect = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-header-foreground hover:bg-white/10"
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, actions, records..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {searchCategories.map((category) => (
            <CommandGroup key={category.title} heading={category.title}>
              {category.items.map((item) => (
                <CommandItem
                  key={item.href}
                  value={item.name}
                  onSelect={() => handleSelect(item.href)}
                >
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
