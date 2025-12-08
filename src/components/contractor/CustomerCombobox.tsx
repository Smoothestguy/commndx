import React, { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Language, getTranslation } from "./translations";

interface Customer {
  id: string;
  name: string;
}

interface CustomerComboboxProps {
  value: string;
  onChange: (value: string) => void;
  customers: Customer[];
  language: Language;
}

export function CustomerCombobox({ value, onChange, customers, language }: CustomerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const t = (key: Parameters<typeof getTranslation>[1]) => getTranslation(language, key);

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showAddOption = searchValue.trim() !== "" && 
    !customers.some(c => c.name.toLowerCase() === searchValue.toLowerCase());

  const handleSelect = (customerName: string) => {
    onChange(customerName);
    setOpen(false);
    setSearchValue("");
  };

  const handleAddNew = () => {
    onChange(searchValue.trim());
    setOpen(false);
    setSearchValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || (
            <span className="text-muted-foreground">{t("selectCustomer")}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={t("typeToSearch")} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              {!showAddOption && t("noCustomerFound")}
            </CommandEmpty>
            
            {showAddOption && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleAddNew}
                  className="text-primary cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addNew")} "{searchValue.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
            
            {filteredCustomers.length > 0 && (
              <CommandGroup>
                {filteredCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.name}
                    onSelect={() => handleSelect(customer.name)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === customer.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {customer.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
