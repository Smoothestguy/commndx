
# Add Trash to Quick Access Panel

## Overview

Add a "Trash" section to the Quick Access panel (`LeftPanel.tsx`) to provide quick visibility into recently deleted items, matching the existing pattern used by other sections like Reminders, Alerts, and Messages.

---

## Changes Required

| File | Change |
|------|--------|
| `src/components/layout/netsuite/LeftPanel.tsx` | Add Trash section with icon, badge count, and expandable list of deleted items |

---

## Technical Details

### 1. Add Import

```tsx
import { Trash2 } from "lucide-react";
import { useDeletedItems, getEntityLabel } from "@/integrations/supabase/hooks/useTrash";
```

### 2. Add State Variable

```tsx
const [trashOpen, setTrashOpen] = useState(false);
```

### 3. Add Data Fetch

```tsx
const { data: deletedItems } = useDeletedItems(undefined, 5);
```

### 4. Add Collapsed State Icon (in the collapsed view section)

Add between Recent Projects and Messages icons:

```tsx
{/* Trash */}
<Tooltip>
  <TooltipTrigger asChild>
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative"
      onClick={() => { onToggleCollapse(); setTrashOpen(true); }}
    >
      <Trash2 className="h-4 w-4" />
      {(deletedItems?.length ?? 0) > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-muted-foreground text-background text-[10px] rounded-full flex items-center justify-center">
          {deletedItems?.length}
        </span>
      )}
    </Button>
  </TooltipTrigger>
  <TooltipContent side="right">Trash</TooltipContent>
</Tooltip>
```

### 5. Add Expanded State Section (in the expanded view section)

Add between Recent Projects and Messages sections:

```tsx
{/* Trash Section */}
<Collapsible open={trashOpen} onOpenChange={setTrashOpen}>
  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
    <div className="flex items-center gap-2">
      <Trash2 className="h-4 w-4 text-muted-foreground" />
      <span>Trash</span>
      {(deletedItems?.length ?? 0) > 0 && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {deletedItems?.length}
        </Badge>
      )}
    </div>
    <ChevronRight className={cn("h-4 w-4 transition-transform", trashOpen && "rotate-90")} />
  </CollapsibleTrigger>
  <CollapsibleContent className="mt-1">
    <div className="space-y-1 pl-6">
      {deletedItems?.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No deleted items</p>
      )}
      {deletedItems?.map((item) => (
        <Link
          key={item.id}
          to="/admin/trash"
          className="block rounded-md p-2 text-xs hover:bg-muted transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{item.identifier}</span>
            <Badge variant="outline" className="text-[10px]">
              {getEntityLabel(item.entity_type)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
          </p>
        </Link>
      ))}
      <Link
        to="/admin/trash"
        className="block rounded-md p-2 text-xs text-muted-foreground hover:bg-muted transition-colors font-medium"
      >
        View All Trash →
      </Link>
    </div>
  </CollapsibleContent>
</Collapsible>
```

---

## Updated Quick Access Panel

After implementation:

| Section | Icon | Badge | Data Source |
|---------|------|-------|-------------|
| Recently Accessed | Clock (blue) | Count | `useRecentPages` |
| Reminders | Bell (primary) | Count | Pending estimates |
| Alerts | AlertTriangle (destructive) | Count | Overdue invoices |
| Recent Projects | History (muted) | - | Recent projects |
| **Trash** | Trash2 (muted) | Count | `useDeletedItems` |
| Messages | MessageSquare (blue) | Count | Unread conversations |

---

## Result

- Trash appears in Quick Access panel with a count badge showing recently deleted items
- Users can expand to see the 5 most recent deleted items with entity type and time
- Clicking any item or "View All Trash" navigates to `/admin/trash`
- Works in both collapsed (icon only) and expanded (full list) panel modes
