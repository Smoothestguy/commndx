import { ArrowLeft, ArrowRight, ChevronRight, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useNavigationHistory } from "@/hooks/useNavigationHistory";
import { useRecentPages } from "@/hooks/useRecentPages";

const formatRelative = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function NavBar() {
  const { canBack, canForward, goBack, goForward } = useNavigationHistory();
  const crumbs = useBreadcrumbs();
  const recent = useRecentPages();
  const navigate = useNavigate();

  return (
    <div className="hidden md:flex items-center gap-2 h-9 px-3 border-b border-border bg-background/60 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={!canBack}
        onClick={goBack}
        title="Back"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={!canForward}
        onClick={goForward}
        title="Forward"
        aria-label="Forward"
      >
        <ArrowRight className="h-4 w-4" />
      </Button>

      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs min-w-0 overflow-hidden">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <div key={c.path} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              {last ? (
                <span className="text-foreground font-medium truncate">{c.label}</span>
              ) : (
                <Link
                  to={c.path}
                  className="text-muted-foreground hover:text-foreground truncate"
                >
                  {c.label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Recent
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Recently viewed</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {recent.length === 0 ? (
            <DropdownMenuItem disabled>No recent pages</DropdownMenuItem>
          ) : (
            recent.map((r) => (
              <DropdownMenuItem
                key={r.path + r.visitedAt}
                onSelect={() => navigate(r.path)}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{r.name}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {formatRelative(r.visitedAt)}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
