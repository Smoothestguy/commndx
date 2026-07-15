import { Link } from "react-router-dom";
import {
  Clock,
  ClipboardList,
  Receipt,
  ShoppingCart,
  UserCog,
  Users,
  FolderSearch,
  FileText,
  TrendingDown,
  FolderKanban,
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SEO } from "@/components/SEO";

interface ReportCard {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const REPORTS: ReportCard[] = [
  // Genuine analytics/report pages
  {
    title: "Overhead Analysis",
    description: "Non-project labor utilization and margin analysis",
    href: "/overhead-analysis",
    icon: TrendingDown,
    category: "Analytics",
  },

  // Operations launchpads
  {
    title: "Time & Labor",
    description: "Time entries, weekly hours, overtime and approvals",
    href: "/time-tracking",
    icon: Clock,
    category: "Operations",
  },
  {
    title: "Crew Assignments",
    description: "Active personnel assignments across all projects",
    href: "/project-assignments",
    icon: UserCog,
    category: "Operations",
  },
  {
    title: "Projects",
    description: "Project performance, budgets and profitability",
    href: "/projects",
    icon: FolderKanban,
    category: "Operations",
  },

  // Financial launchpads
  {
    title: "Invoices & AR",
    description: "Customer invoices, aging and payment status",
    href: "/invoices",
    icon: Receipt,
    category: "Financials",
  },
  {
    title: "Purchase Orders",
    description: "Vendor purchase orders and commitments",
    href: "/purchase-orders",
    icon: ShoppingCart,
    category: "Financials",
  },
  {
    title: "Vendor Bills",
    description: "Bills, payments and outstanding vendor liabilities",
    href: "/vendor-bills",
    icon: Receipt,
    category: "Financials",
  },

  // Recruiting
  {
    title: "Job Postings",
    description: "Active postings and applicant pipeline",
    href: "/staffing/applications",
    icon: ClipboardList,
    category: "Recruiting",
  },
  {
    title: "Applicant Pool",
    description: "Full applicant pool — filter, invite and export",
    href: "/staffing/applicants",
    icon: Users,
    category: "Recruiting",
  },

  // Documents
  {
    title: "Document Center",
    description: "Central repository of company documents",
    href: "/document-center",
    icon: FolderSearch,
    category: "Documents",
  },
  {
    title: "Vendor Documents",
    description: "W-9s, agreements and vendor compliance records",
    href: "/vendor-documents",
    icon: FileText,
    category: "Documents",
  },
];

const CATEGORY_ORDER = [
  "Analytics",
  "Operations",
  "Financials",
  "Recruiting",
  "Documents",
];

export default function Reports() {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: REPORTS.filter((r) => r.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <PageLayout title="Reports Hub">
      <SEO
        title="Reports Hub | Fairfield"
        description="Central launchpad for reports, analytics and exports across operations, financials and recruiting."
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Jump to any report, analytics view, or export. Grouped by area.
          </p>
        </div>

        {grouped.map((group) => (
          <section key={group.category} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.category}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((r) => {
                const Icon = r.icon;
                return (
                  <Link key={r.href} to={r.href} className="block group">
                    <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          {r.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-sm">
                          {r.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
