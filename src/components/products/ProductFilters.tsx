import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
const typeOptions: { value: ItemType | ""; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "product", label: "Products" },
  { value: "service", label: "Services" },
  { value: "labor", label: "Labor" },
];
const alphabet = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "#",
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
  // Filter categories based on selected type
  const filteredCategories = selectedType
    ? Array.from(
        new Set(
          products
            .filter((p) => p.item_type === selectedType)
            .map((p) => p.category)
        )
      )
    : categories;

  // Auto-reset category if it doesn't exist in filtered list
  useEffect(() => {
    if (selectedCategory && !filteredCategories.includes(selectedCategory)) {
      onCategoryChange("");
    }
  }, [selectedType, filteredCategories, selectedCategory, onCategoryChange]);

  // Auto-reset letter if no products match (after type change)
  useEffect(() => {
    if (selectedLetter) {
      const hasProducts = products.some((p) => {
        const matchesType = !selectedType || p.item_type === selectedType;
        const firstChar = p.name.charAt(0).toUpperCase();
        const matchesLetter =
          selectedLetter === "#"
            ? /[0-9]/.test(firstChar)
            : firstChar === selectedLetter;
        return matchesType && matchesLetter;
      });
      if (!hasProducts) {
        onLetterChange("");
      }
    }
  }, [selectedType, products, selectedLetter, onLetterChange]);

  // Check if a letter has any matching products
  const hasProductsForLetter = (letter: string) => {
    return products.some((p) => {
      const matchesType = !selectedType || p.item_type === selectedType;
      const firstChar = p.name.charAt(0).toUpperCase();
      const matchesLetter =
        letter === "#" ? /[0-9]/.test(firstChar) : firstChar === letter;
      return matchesType && matchesLetter;
    });
  };
  return (
    <div className="space-y-2 mb-4 sm:mb-6">
      {/* Single Row: Type Dropdown + Category Pills */}
      <div className="flex items-center gap-2">
        {/* Type Filter - Compact Dropdown */}
        <Select value={selectedType} onValueChange={(v) => onTypeChange(v as ItemType | "")}>
          <SelectTrigger className="w-[120px] sm:w-[140px] min-h-[36px] sm:min-h-[40px] text-xs sm:text-sm bg-background shrink-0">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value || "all"}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Pills - Horizontal scroll */}
        <div className="overflow-x-auto flex-1 scrollbar-hide">
          <div className="flex gap-1.5 sm:gap-2 min-w-max">
            <button
              onClick={() => onCategoryChange("")}
              className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 min-h-[36px] sm:min-h-[40px] whitespace-nowrap ${
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
                className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 min-h-[36px] sm:min-h-[40px] whitespace-nowrap ${
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 active:bg-secondary/70"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Filters Display - Separate row when active */}
      {(selectedCategory || selectedType || selectedLetter) && (
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-xs sm:text-sm text-muted-foreground">
            Active:
          </span>
          {selectedType && (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 min-h-[32px]">
              <span className="text-xs sm:text-sm font-medium capitalize">
                {selectedType}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => onTypeChange("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {selectedLetter && (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 min-h-[32px]">
              <span className="text-xs sm:text-sm font-medium">
                {selectedLetter === "#" ? "#" : selectedLetter}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => onLetterChange("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {selectedCategory && (
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 min-h-[32px] max-w-[120px] sm:max-w-none">
              <span className="text-xs sm:text-sm font-medium truncate">
                {selectedCategory}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent shrink-0"
                onClick={() => onCategoryChange("")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
