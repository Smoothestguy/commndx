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

const typeOptions: { value: ItemType | ""; label: string; icon: typeof Package }[] = [
  { value: "", label: "All Types", icon: Package },
  { value: "product", label: "Products", icon: Package },
  { value: "service", label: "Services", icon: Wrench },
  { value: "labor", label: "Labor", icon: HardHat },
];

const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
                  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

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
    ? Array.from(new Set(products.filter(p => p.item_type === selectedType).map(p => p.category)))
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
      const hasProducts = products.some(p => {
        const matchesType = !selectedType || p.item_type === selectedType;
        const firstChar = p.name.charAt(0).toUpperCase();
        const matchesLetter = selectedLetter === '#' 
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
    return products.some(p => {
      const matchesType = !selectedType || p.item_type === selectedType;
      const firstChar = p.name.charAt(0).toUpperCase();
      const matchesLetter = letter === '#' 
        ? /[0-9]/.test(firstChar) 
        : firstChar === letter;
      return matchesType && matchesLetter;
    });
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Type Filter */}
      <div className="flex flex-wrap gap-2">
        {typeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              onClick={() => onTypeChange(option.value)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                selectedType === option.value
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>

      {/* A-Z Filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => onLetterChange("")}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-all duration-200 ${
            selectedLetter === ""
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
          }`}
        >
          All
        </button>
        {alphabet.map((letter) => {
          const hasProducts = hasProductsForLetter(letter);
          return (
            <button
              key={letter}
              onClick={() => hasProducts && onLetterChange(letter)}
              disabled={!hasProducts}
              className={`w-8 h-8 rounded text-sm font-medium transition-all duration-200 ${
                selectedLetter === letter
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : hasProducts 
                    ? "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    : "bg-secondary/50 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCategoryChange("")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            selectedCategory === ""
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
          }`}
        >
          All Categories
        </button>
        {filteredCategories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              selectedCategory === category
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Active Filters Display */}
      {(selectedCategory || selectedType || selectedLetter) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {selectedType && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              <span className="text-sm font-medium capitalize">{selectedType}</span>
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              <span className="text-sm font-medium">
                Starts with: {selectedLetter === '#' ? 'Number' : selectedLetter}
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              <span className="text-sm font-medium">{selectedCategory}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
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
