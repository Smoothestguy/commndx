import { useLocation } from "react-router-dom";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useUserRole } from "@/hooks/useUserRole";
import { useDashboardDraft } from "@/contexts/DashboardDraftContext";

// Map route paths to page identifiers
const ROUTE_TO_PAGE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/products": "products",
  "/customers": "customers",
  "/projects": "projects",
  "/personnel": "personnel",
  "/estimates": "estimates",
  "/purchase-orders": "purchase-orders",
  "/invoices": "invoices",
  "/messages": "messages",
  "/settings": "settings",
};

function getPageIdFromPath(pathname: string): string | null {
  // Exact match first
  if (ROUTE_TO_PAGE_MAP[pathname]) {
    return ROUTE_TO_PAGE_MAP[pathname];
  }
  
  // Check for path prefix matches (e.g., /settings/quickbooks -> settings)
  for (const [route, pageId] of Object.entries(ROUTE_TO_PAGE_MAP)) {
    if (route !== "/" && pathname.startsWith(route)) {
      return pageId;
    }
  }
  
  return null;
}

export function BackgroundMediaLayer() {
  const location = useLocation();
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { activeTheme: savedTheme, isLoading: configLoading } = useDashboardConfig();
  const draftContext = useDashboardDraft();

  // Don't render anything while loading
  if (roleLoading || configLoading) {
    return null;
  }

  // Only apply background for admin/manager users with customization access
  const canCustomize = isAdmin || isManager;
  if (!canCustomize) {
    return null;
  }

  // Use draft theme when in edit mode, otherwise use saved theme
  const activeTheme = (draftContext?.isEditMode && draftContext?.draftTheme)
    ? draftContext.draftTheme
    : savedTheme;

  const hasBackgroundMedia = activeTheme?.backgroundVideo || activeTheme?.backgroundImage;
  if (!hasBackgroundMedia) {
    return null;
  }

  // Determine current page from route
  const currentPageId = getPageIdFromPath(location.pathname);
  if (!currentPageId) {
    return null;
  }

  // Check if background should show on current page
  // Default to ["dashboard"] if backgroundPages is not set (backward compatibility)
  const backgroundPages = activeTheme.backgroundPages ?? ["dashboard"];
  if (!backgroundPages.includes(currentPageId)) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {activeTheme.backgroundVideo ? (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ objectPosition: activeTheme.backgroundPosition || "center" }}
          src={activeTheme.backgroundVideo}
        />
      ) : activeTheme.backgroundImage ? (
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url(${activeTheme.backgroundImage})`,
            backgroundSize: activeTheme.backgroundSize || "cover",
            backgroundPosition: activeTheme.backgroundPosition || "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : null}

      {/* Dark Overlay for Readability */}
      {activeTheme.backgroundOverlay && activeTheme.backgroundOverlay > 0 && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: activeTheme.backgroundOverlay / 100 }}
        />
      )}
    </div>
  );
}
