
# Plan: Enable Right-Click Context Menus

## Overview

Add right-click context menu support to the application's main interactive components. The context menu will provide quick access to common actions (View, Edit, Delete, etc.) without needing to click a "More" button.

## Strategy

Create a reusable approach that:
1. Adds context menu support to the `EnhancedDataTable` component (used across Personnel, Invoices, Projects, Customers, etc.)
2. Adds context menu support to key card components
3. Uses the existing `ContextMenu` component from `@radix-ui/react-context-menu`

---

## Phase 1: Enhanced Data Table Context Menu

### 1.1 Add Context Menu Props to EnhancedDataTable

| File | Change |
|------|--------|
| `src/components/shared/EnhancedDataTable.tsx` | Add optional `contextMenuItems` prop and wrap rows with ContextMenuTrigger |

**New Props:**
```typescript
interface ContextMenuItem<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (item: T) => void;
  variant?: 'default' | 'destructive';
  condition?: (item: T) => boolean; // Show only when condition is true
  separator?: boolean; // Add separator after this item
}

interface EnhancedDataTableProps<T> {
  // ... existing props
  contextMenuItems?: ContextMenuItem<T>[];
}
```

**Implementation:**
- Wrap each `TableRow` in a `ContextMenu` + `ContextMenuTrigger`
- Render `ContextMenuContent` with the provided menu items
- Only show context menu if `contextMenuItems` is provided

### 1.2 Example Usage (Customers Page)

```typescript
const contextMenuItems = [
  {
    label: "View Details",
    icon: Eye,
    onClick: (customer) => navigate(`/customers/${customer.id}`),
  },
  {
    label: "Edit",
    icon: Edit,
    onClick: (customer) => setEditingCustomer(customer),
  },
  {
    label: "Delete",
    icon: Trash2,
    onClick: (customer) => handleDelete(customer.id),
    variant: 'destructive',
    separator: true, // Add separator before
  },
];

<EnhancedDataTable
  tableId="customers"
  data={customers}
  columns={columns}
  contextMenuItems={contextMenuItems}
/>
```

---

## Phase 2: Card Components with Context Menu

### 2.1 Create a Reusable ContextMenuWrapper Component

| File | Change |
|------|--------|
| `src/components/shared/ContextMenuWrapper.tsx` | New reusable component for wrapping any element with context menu |

```typescript
interface ContextMenuWrapperProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
}

export function ContextMenuWrapper({ children, items }: ContextMenuWrapperProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {items.map((item, index) => (
          <Fragment key={index}>
            {item.separator && <ContextMenuSeparator />}
            <ContextMenuItem onClick={item.onClick}>
              {item.icon && <item.icon className="mr-2 h-4 w-4" />}
              {item.label}
            </ContextMenuItem>
          </Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
```

### 2.2 Update Card Components

| Component | File |
|-----------|------|
| CustomerCard | `src/components/customers/CustomerCard.tsx` |
| ChangeOrderCard | `src/components/change-orders/ChangeOrderCard.tsx` |
| VendorBillCard | `src/components/vendor-bills/VendorBillCard.tsx` |
| MobilePersonnelCard | `src/components/personnel/MobilePersonnelCard.tsx` |

Each card will be wrapped with `ContextMenuWrapper`, reusing the same menu items from the existing DropdownMenu.

**Example - CustomerCard:**
```typescript
return (
  <ContextMenu>
    <ContextMenuTrigger asChild>
      <div className="glass rounded-xl p-4...">
        {/* existing card content */}
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onClick={() => onEdit(customer)}>
        <Edit className="mr-2 h-4 w-4" />
        Edit
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem 
        onClick={() => onDelete(customer.id)}
        className="text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
);
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/shared/ContextMenuWrapper.tsx` | Create | Reusable context menu wrapper component |
| `src/components/shared/EnhancedDataTable.tsx` | Modify | Add contextMenuItems prop and wrap rows |
| `src/components/customers/CustomerCard.tsx` | Modify | Add right-click context menu |
| `src/components/change-orders/ChangeOrderCard.tsx` | Modify | Add right-click context menu |
| `src/components/vendor-bills/VendorBillCard.tsx` | Modify | Add right-click context menu |
| `src/components/personnel/MobilePersonnelCard.tsx` | Modify | Add right-click context menu |
| `src/pages/Customers.tsx` | Modify | Pass contextMenuItems to EnhancedDataTable |
| `src/pages/Projects.tsx` | Modify | Pass contextMenuItems to EnhancedDataTable |
| `src/pages/Invoices.tsx` | Modify | Pass contextMenuItems to EnhancedDataTable |

---

## Technical Details

### EnhancedDataTable Row Rendering Update

```typescript
// Before
<TableRow key={item.id} onClick={() => onRowClick?.(item)}>
  {/* cells */}
</TableRow>

// After
{contextMenuItems ? (
  <ContextMenu key={item.id}>
    <ContextMenuTrigger asChild>
      <TableRow onClick={() => onRowClick?.(item)}>
        {/* cells */}
      </TableRow>
    </ContextMenuTrigger>
    <ContextMenuContent>
      {contextMenuItems.map((menuItem, idx) => {
        if (menuItem.condition && !menuItem.condition(item)) return null;
        return (
          <Fragment key={idx}>
            {menuItem.separator && <ContextMenuSeparator />}
            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                menuItem.onClick(item);
              }}
              className={menuItem.variant === 'destructive' ? 'text-destructive' : ''}
            >
              {menuItem.icon && <menuItem.icon className="mr-2 h-4 w-4" />}
              {menuItem.label}
            </ContextMenuItem>
          </Fragment>
        );
      })}
    </ContextMenuContent>
  </ContextMenu>
) : (
  <TableRow key={item.id} onClick={() => onRowClick?.(item)}>
    {/* cells */}
  </TableRow>
)}
```

---

## User Experience

After implementation:
- **Tables**: Right-click any row to see View, Edit, Delete options (and page-specific actions)
- **Cards**: Right-click any card to see the same options as the "..." dropdown menu
- **Consistency**: Context menu items mirror the existing dropdown menus for familiar UX
- **Desktop-first**: Context menus primarily benefit desktop users with mice
- **Accessibility**: Left-click and dropdown menus remain fully functional

---

## Benefits

1. **Faster workflows** - Power users can right-click instead of finding the "..." button
2. **Familiar UX** - Standard desktop convention that users expect
3. **No UI clutter** - Context menu is hidden until needed
4. **Reusable** - `ContextMenuWrapper` can be applied to any component
