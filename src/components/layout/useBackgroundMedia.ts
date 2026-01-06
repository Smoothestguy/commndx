import { useLocation } from "react-router-dom";
import { useDashboardDraft } from "@/contexts/DashboardDraftContext";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useUserRole } from "@/hooks/useUserRole";

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
  if (ROUTE_TO_PAGE_MAP[pathname]) {
    return ROUTE_TO_PAGE_MAP[pathname];
  }
  for (const [route, pageId] of Object.entries(ROUTE_TO_PAGE_MAP)) {
    if (route !== "/" && pathname.startsWith(route)) {
      return pageId;
    }
  }
  return null;
}

export function useBackgroundMedia() {
  const { pathname } = useLocation();
  const { isAdmin, isManager, loading: roleLoading } = useUserRole();
  const { activeTheme: savedTheme, isLoading: configLoading } = useDashboardConfig();
  const draftContext = useDashboardDraft();

  const isLoading = roleLoading || configLoading;
  const canCustomize = isAdmin || isManager;

  if (isLoading || !canCustomize) {
    return { shouldShowBackground: false, activeTheme: null, isLoading };
  }

  const isEditMode = draftContext?.isEditMode ?? false;
  const activeTheme = isEditMode && draftContext?.draftTheme ? draftContext.draftTheme : savedTheme;

  const hasBackgroundMedia = !!(activeTheme?.backgroundVideo || activeTheme?.backgroundImage);
  if (!hasBackgroundMedia) {
    return { shouldShowBackground: false, activeTheme, isLoading };
  }

  const backgroundPages = activeTheme?.backgroundPages || ["dashboard"];
  const currentPageId = getPageIdFromPath(pathname);

  if (!currentPageId || !backgroundPages.includes(currentPageId)) {
    return { shouldShowBackground: false, activeTheme, isLoading };
  }

  return { shouldShowBackground: true, activeTheme, isLoading };
}
