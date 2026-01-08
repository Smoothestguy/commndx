import { useEffect } from "react";
import { X, Package, Wrench, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemType, Product } from "@/integrations/supabase/hooks/useProducts";

interface ProductFiltersProps {
  products: Product[];
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedType: ItemType | "";
  onTypeChange: (type: ItemType | "") => void;
  selectedLetter: string;
  onLetterChange: (letter: string) => void;
}

const typeOptions: {
  value: ItemType | "";
  label: string;
  icon: typeof Package;
}[] = [
  { value: "", label: "All Types", icon: Package },
  { value: "product", label: "Products", icon: Package },
  { value: "service", label: "Services", icon: Wrench },
  { value: "labor", label: "Labor", icon: HardHat },
];

export function ProductFilters({
  products,
  categories,
  selectedCategory,
  onCategoryChange,
  selectedType,
  onTypeChange,
  selectedLetter,
  onLetterChange,
}: ProductFiltersProps) {
  const filteredCategories = selectedType
    ? Array.from(new Set(products.filter((p) => p.item_type === selectedType).map((p) => p.category)))
    : categories;

  useEffect(() => {
    if (selectedCategory && !filteredCategories.includes(selectedCategory)) {
      onCategoryChange("");
    }
  }, [selectedType, filteredCategories, selectedCategory, onCategoryChange]);

  useEffect(() => {
    if (selectedLetter) {
      const hasProducts = products.some((p) => {
        const matchesType = !selectedType || p.item_type === selectedType;
        const firstChar = p.name.charAt(0).toUpperCase();
        const matchesLetter = selectedLetter === "#" ? /[0-9]/.test(firstChar) : firstChar === selectedLetter;
        return matchesType && matchesLetter;
      });
      if (!hasProducts) {
        onLetterChange("");
      }
    }
  }, [selectedType, products, selectedLetter, onLetterChange]);

  return (
    <div className="space-y-4 md:space-y-5 mb-4 md:mb-6">
      {/* Type Filter - Grid on iPad for better touch targets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {typeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => onTypeChange(option.value)}
              className={`inline-flex items-center justify-center gap-2 px-4 py-3 md:py-3.5 rounded-xl text-sm md:text-base font-medium transition-all duration-200 ${
                selectedType === option.value
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 active:bg-secondary/70"
              }`}
            >
              <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Category Pills - Wrap on iPad instead of scroll */}
      <div className="flex flex-wrap gap-2 md:gap-2.5">
        <button
          onClick={() => onCategoryChange("")}
          className={`px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-medium transition-all duration-200 ${
            selectedCategory === ""
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80 active:bg-secondary/70"
          }`}
        >
          All Categories
        </button>
        {filteredCategories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-4 py-2.5 md:py-3 rounded-xl text-sm md:text-base font-medium transition-all duration-200 ${
              selectedCategory === category
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 active:bg-secondary/70"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Active Filters Display */}
      {(selectedCategory || selectedType || selectedLetter) && (
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <span className="text-sm md:text-base text-muted-foreground">Active:</span>
          {selectedType && (
            <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <span className="text-sm md:text-base font-medium capitalize">{selectedType}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 md:h-6 md:w-6 p-0 hover:bg-transparent"
                onClick={() => onTypeChange("")}
              >
                <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </div>
          )}
          {selectedLetter && (
            <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <span className="text-sm md:text-base font-medium">{selectedLetter === "#" ? "#" : selectedLetter}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 md:h-6 md:w-6 p-0 hover:bg-transparent"
                onClick={() => onLetterChange("")}
              >
                <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </div>
          )}
          {selectedCategory && (
            <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <span className="text-sm md:text-base font-medium">{selectedCategory}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 md:h-6 md:w-6 p-0 hover:bg-transparent shrink-0"
                onClick={() => onCategoryChange("")}
              >
                <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
