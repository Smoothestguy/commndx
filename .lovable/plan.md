

## Fix: Allow All Floor Groups to Be Collapsed

### Problem
In `RoomsDataTable.tsx`, there is initialization logic that runs on every render:

```typescript
if (expandedFloors.size === 0 && floors.length > 0) {
  floors.forEach(f => expandedFloors.add(f));
}
```

This mutates state directly during render and re-expands all floors whenever the set becomes empty -- making it impossible to collapse the last open floor group.

### Fix
Replace the render-time mutation with proper `useState` initialization using a lazy initializer or a `useEffect`. The simplest approach: initialize the state with all floors expanded via a function, and remove the render-time mutation entirely.

### Technical Details

In `src/components/project-hub/rooms/RoomsDataTable.tsx`:

1. Change the `useState` for `expandedFloors` to accept a default derived from `rooms` (compute floors from rooms prop and initialize them as expanded).
2. Remove the render-time `if (expandedFloors.size === 0 ...)` block entirely.

Since `floors` depends on `rooms` which is a prop, use a `useEffect` to set initial expanded state only on first load (when rooms change from empty to populated), or simply initialize with all floor keys from the rooms prop.

**Approach**: Use a ref to track whether initial expansion has happened, and only auto-expand once.

```typescript
const [expandedFloors, setExpandedFloors] = useState<Set<number>>(() => {
  // Compute initial floors from rooms prop
  const initialFloors = new Set<number>();
  rooms.forEach(room => {
    initialFloors.add(room.floor_number || 0);
  });
  return initialFloors;
});
```

Remove lines 79-82 (the render-time mutation block).

### Files Changed
| File | Change |
|------|--------|
| `src/components/project-hub/rooms/RoomsDataTable.tsx` | Initialize expanded floors in useState, remove render-time mutation |

