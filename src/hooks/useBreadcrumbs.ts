import { useLocation } from "react-router-dom";
import { getPageName } from "./useRecentPages";

export interface Crumb {
  label: string;
  path: string;
}

/**
 * Build a breadcrumb trail from the current URL by walking each path segment.
 * Labels come from the shared getPageName helper so wording stays consistent
 * with Recent Pages and the tab bar.
 */
export function useBreadcrumbs(): Crumb[] {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ label: "Home", path: "/" }];
  }

  const crumbs: Crumb[] = [{ label: "Home", path: "/" }];
  let acc = "";
  segments.forEach((seg) => {
    acc += "/" + seg;
    if (seg === 'staffing' || (seg === 'locations' && segments[0] === 'projects')) return;
    const dynamic = /^[0-9a-f]{8}-/i.test(seg);
    const routeLabel = dynamic ? (segments.includes('locations') && seg === segments.at(-1) ? 'Location' : getPageName(acc)) : seg === 'applications' ? 'Job Postings' : getPageName('/' + seg);
    crumbs.push({ label: routeLabel, path: acc });
  });
  return crumbs;
}
