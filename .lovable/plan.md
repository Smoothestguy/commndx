

## Fix: Scrolling in AI Mapping Advisor Dialog

The ScrollArea inside the dialog doesn't scroll because it lacks a concrete height constraint. The `flex-1` class alone doesn't create a scrollable region without `min-h-0` (to allow flex shrinking below content size) and `overflow-hidden` on the dialog content.

### Changes

**`src/components/quickbooks/MappingAdvisor.tsx`**
- Add `overflow-hidden` to `DialogContent` className (so flex children are constrained)
- Add `min-h-0` to the `ScrollArea` className (allows it to shrink and scroll)

