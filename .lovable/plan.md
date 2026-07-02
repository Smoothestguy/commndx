## Goal

Make it faster to move around the admin app so users don't lose their place. Add three coordinated navigation aids to the app shell: **browser-style tabs**, a **Back button + breadcrumbs**, and a **Recent Pages** dropdown. Desktop/tablet only (`md:` and up). Portals untouched.

## What the user will see

A new **NavBar strip** appears directly under the existing `AppHeader`, only on `md+` screens, only inside `SidebarLayout` (so it's admin-only and never shows in portals or on `/auth`):

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [←] [→]  Home › Projects › Job Order #123      🕘 Recent ▾              │
├────────────────────────────────────────────────────────────────────────┤
│ [ Dashboard ] [ Projects ] [• Job Order #123 ×] [ Messages × ] [ + ]   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                       (existing page content)                          │
```

### 1. Tabs row
- Each visited admin route becomes a tab (label from the existing `getPageName` map in `useRecentPages`, extended for detail routes to include the record's title when available from React Query cache).
- Click a tab → navigate to it. The currently active route is highlighted.
- Close (×) removes the tab; closing the active tab falls back to the previous tab or `/`.
- Tabs persist in `localStorage` (`appTabs`) so they survive refresh.
- Cap at 12 tabs; oldest inactive tab is evicted when the cap is hit.
- Horizontal scroll with mouse-wheel/trackpad when tabs overflow.
- **Note on state:** true "frozen page state per tab" would require keeping every visited page mounted, which is a major refactor and memory cost. We rely on React Query's cache (already project-wide) to make revisiting a tab feel instant. Forms with unsaved changes still trigger the existing `useUnsavedChangesWarning` dialog.

### 2. Back / Forward + breadcrumbs
- `←` and `→` arrows drive `navigate(-1)` / `navigate(1)`; disabled state derived from a small history stack we maintain (browser history doesn't expose length reliably).
- Breadcrumbs generated from the current path segments using the same label map, with the final segment resolved to the record name from React Query cache when possible (project name, PO number, personnel name, etc.).

### 3. Recent Pages dropdown
- Feeds directly off the existing `useRecentPages` hook — no new storage.
- Shows last 10 with a small clock icon and relative time.
- Click → navigate.

## Files to create

- `src/components/layout/NavBar.tsx` — the strip: back/forward, breadcrumbs, recent menu.
- `src/components/layout/TabsBar.tsx` — the tab strip.
- `src/hooks/useAppTabs.ts` — tab state, persistence, add-on-route-change, close, reorder cap.
- `src/hooks/useNavigationHistory.ts` — internal back/forward stack + enable/disable flags.
- `src/hooks/useBreadcrumbs.ts` — path → breadcrumb items, with React Query cache lookup for detail routes.

## Files to modify

- `src/components/layout/SidebarLayout.tsx` — render `<NavBar />` and `<TabsBar />` above `<Outlet />`, both wrapped in `hidden md:block` so mobile/phone stays unchanged.
- `src/hooks/useRecentPages.ts` — export the existing `getPageName` helper so `useAppTabs` and `useBreadcrumbs` reuse it (no logic changes).

Nothing in `AppHeader`, `MobileNav`, `BottomNav`, portals, or `/auth` changes.

## Out of scope

- Real multi-instance page state (keeping every tab's DOM mounted).
- Tabs on mobile (`< md`) or in Personnel / Vendor / Subcontractor portals.
- Drag-to-reorder tabs — can add later if requested.
