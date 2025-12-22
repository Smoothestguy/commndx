import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "./use-mobile";
import { useSwipeGesture } from "./useSwipeGesture";

const NAVIGATION_ORDER = [
  { path: "/", name: "Dashboard" },
  { path: "/projects", name: "Projects" },
  { path: "/customers", name: "Customers" },
  { path: "/vendors", name: "Vendors" },
  { path: "/products", name: "Products" },
  { path: "/estimates", name: "Estimates" },
  { path: "/purchase-orders", name: "Purchase Orders" },
  { path: "/invoices", name: "Invoices" },
];

export function useSwipeNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const currentIndex = NAVIGATION_ORDER.findIndex(
    (page) => page.path === location.pathname
  );

  const handleSwipeLeft = () => {
    if (!isMobile || currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % NAVIGATION_ORDER.length;
    navigate(NAVIGATION_ORDER[nextIndex].path);
  };

  const handleSwipeRight = () => {
    if (!isMobile || currentIndex === -1) return;
    const prevIndex =
      (currentIndex - 1 + NAVIGATION_ORDER.length) % NAVIGATION_ORDER.length;
    navigate(NAVIGATION_ORDER[prevIndex].path);
  };

  const swipeRef = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 100, // Higher threshold for page navigation
  });

  return {
    swipeRef,
    isMobile,
    currentPage: currentIndex !== -1 ? NAVIGATION_ORDER[currentIndex] : null,
    nextPage:
      currentIndex !== -1
        ? NAVIGATION_ORDER[(currentIndex + 1) % NAVIGATION_ORDER.length]
        : null,
    prevPage:
      currentIndex !== -1
        ? NAVIGATION_ORDER[
            (currentIndex - 1 + NAVIGATION_ORDER.length) %
              NAVIGATION_ORDER.length
          ]
        : null,
  };
}
