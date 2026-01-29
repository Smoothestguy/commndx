import { SEO } from "@/components/SEO";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Building2, 
  FileText, 
  Clock, 
  UserCheck, 
  MessageSquare, 
  RefreshCw, 
  Briefcase, 
  DoorOpen, 
  Shield, 
  Smartphone, 
  FileArchive, 
  Sparkles,
  ChevronDown,
  MapPin,
  CreditCard,
  Globe
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FeatureCategory {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
}

const featureCategories: FeatureCategory[] = [
  {
    id: "dashboard",
    icon: <LayoutDashboard className="h-6 w-6" />,
    title: "Dashboard & KPIs",
    description: "Real-time business intelligence at your fingertips",
    features: [
      "Customizable widget-based dashboard",
      "Real-time KPI stats (revenue, active projects, staffing, pending invoices)",
      "Activity feed showing recent actions",
      "Quick action buttons for common tasks",
      "Welcome banner with user greeting",
      "Trash widget to recover deleted items",
    ],
  },
  {
    id: "projects",
    icon: <FolderKanban className="h-6 w-6" />,
    title: "Project Management",
    description: "End-to-end project lifecycle tracking",
    features: [
      "Create and track projects with statuses: Quote, Task Order, Active, Complete, Canceled",
      "Individual vs Team project classification",
      "Personnel assignments to projects",
      "Site location with GPS coordinates and geofence radius",
      "Project-level settings for time clock requirements",
      "Link to customers, estimates, job orders, invoices",
    ],
  },
  {
    id: "customers",
    icon: <Users className="h-6 w-6" />,
    title: "Customer Management",
    description: "Comprehensive customer relationship tracking",
    features: [
      "Full customer database with contact details",
      "Company name, address, email, phone",
      "Link customers to projects and invoices",
      "Customer-specific estimates and job orders",
      "Sync with QuickBooks",
    ],
  },
  {
    id: "vendors",
    icon: <Building2 className="h-6 w-6" />,
    title: "Vendor Management",
    description: "Streamline vendor relationships and payments",
    features: [
      "Vendor database with contact information",
      "Vendor bills and payment tracking",
      "Document uploads per vendor",
      "Specialty and license number tracking",
      "Tax ID and 1099 tracking",
      "Vendor portal access management",
      "Sync with QuickBooks",
    ],
  },
  {
    id: "financials",
    icon: <FileText className="h-6 w-6" />,
    title: "Financial Documents",
    description: "Complete document workflow from estimate to payment",
    features: [
      "Estimates with line items, tax rates, and customer approval workflow",
      "Job Orders generated from approved estimates with progress billing",
      "Change Orders (additive/deductive) with customer approval",
      "Purchase Orders linked to vendors and job orders",
      "Invoices with progress billing and QuickBooks sync",
      "Vendor Bills with approval workflow and payment tracking",
      "Version history and attachment support",
    ],
  },
  {
    id: "timeclock",
    icon: <Clock className="h-6 w-6" />,
    title: "Time & Attendance",
    description: "GPS-verified time tracking with geofencing",
    features: [
      "Clock In/Out with GPS location capture",
      "Lunch break start/end with duration tracking",
      "Real-time hours calculation with sub-second precision",
      "Project-based time tracking",
      "GPS geofencing with configurable radius",
      "Haversine formula for distance calculation",
      "Background location tracking on iOS/Android",
      "Auto-start on device boot",
      "Personal and team timesheet views",
    ],
  },
  {
    id: "personnel",
    icon: <UserCheck className="h-6 w-6" />,
    title: "Personnel Management",
    description: "Complete workforce administration",
    features: [
      "Full personnel records with photo",
      "Contact information, address, SSN (masked)",
      "Citizenship and immigration status tracking",
      "Emergency contacts",
      "Hire date and employment type",
      "Hourly rate and pay type",
      "Status tracking: Active, Inactive, Terminated",
      "Public self-registration portal",
      "Token-based onboarding with W-9 and contractor agreements",
      "Electronic signature with scroll-to-read requirement",
      "Personnel ID badge templates and printing",
    ],
  },
  {
    id: "messaging",
    icon: <MessageSquare className="h-6 w-6" />,
    title: "Messaging & Communications",
    description: "Integrated SMS and in-app messaging",
    features: [
      "SMS messaging via Twilio",
      "Message status tracking: Pending → Sent → Delivered → Failed",
      "Twilio webhook for receiving replies",
      "Conversation-based messaging threads",
      "Real-time typing indicators",
      "Read/delivered status indicators",
      "Bulk SMS to multiple recipients",
      "Automated assignment notifications",
    ],
  },
  {
    id: "quickbooks",
    icon: <RefreshCw className="h-6 w-6" />,
    title: "QuickBooks Integration",
    description: "Two-way sync with QuickBooks Online",
    features: [
      "Products: Import/export product catalog",
      "Customers: Sync customer records",
      "Vendors: Sync with tax ID and 1099 tracking",
      "Invoices: Create and import invoices",
      "Estimates: Sync estimates",
      "Purchase Orders: Export POs",
      "Vendor Bills: Create bills in QuickBooks",
      "Batch processing with progress tracking",
      "Conflict detection and resolution",
      "Account mapping for expense categories",
    ],
  },
  {
    id: "staffing",
    icon: <Briefcase className="h-6 w-6" />,
    title: "Staffing & Recruiting",
    description: "End-to-end applicant tracking",
    features: [
      "Create task orders for projects",
      "Generate public job posting links",
      "Track headcount needed with location and start date",
      "Drag-and-drop form builder with custom themes",
      "Application status workflow: Submitted → Reviewing → Approved/Rejected",
      "Applicant details with photo and answer review",
      "Bulk actions and notes",
      "Export to CSV, Excel, PDF, JSON",
      "Contacted tracking and revoke approval",
    ],
  },
  {
    id: "portals",
    icon: <DoorOpen className="h-6 w-6" />,
    title: "User Portals",
    description: "Dedicated portals for different user types",
    features: [
      "Personnel Portal: Dashboard, time clock, hours history, documents, reimbursements, tax forms",
      "Vendor Portal: PO management, bill submission, payment tracking",
      "Subcontractor Portal: PO viewing, bill submission, back charges",
      "Contractor Portal: Public bill and expense submission with multi-language support",
    ],
  },
  {
    id: "security",
    icon: <Shield className="h-6 w-6" />,
    title: "Security & Administration",
    description: "Enterprise-grade security and access control",
    features: [
      "Email/password authentication",
      "OAuth: Google and Microsoft sign-in",
      "Invitation-based access",
      "Token-based portal access",
      "Role-based access: Admin, Manager, Accounting",
      "Granular permission controls",
      "Audit logs and user activity history",
      "Session history tracking",
      "Soft delete with trash recovery",
    ],
  },
  {
    id: "platform",
    icon: <Smartphone className="h-6 w-6" />,
    title: "Platform Features",
    description: "Native apps for every platform",
    features: [
      "Web: React with responsive design",
      "iOS: Native Capacitor app",
      "Android: Native Capacitor app",
      "macOS: Electron desktop app with auto-updates",
      "Windows: Electron desktop app with auto-updates",
      "Dark/Light theme support",
      "Customizable dashboard widgets with drag-and-drop",
      "Density settings (spreadsheet, compact, normal, relaxed)",
      "Mobile-first responsive design with bottom navigation",
    ],
  },
  {
    id: "documents",
    icon: <FileArchive className="h-6 w-6" />,
    title: "Document Management",
    description: "Centralized document storage and organization",
    features: [
      "Centralized document storage",
      "Category-based organization",
      "File upload support",
      "Access control by role",
      "Attach files to estimates, invoices, POs",
      "Image lightbox preview",
    ],
  },
  {
    id: "additional",
    icon: <Sparkles className="h-6 w-6" />,
    title: "Additional Features",
    description: "Extended functionality and tools",
    features: [
      "AI Assistant for development support",
      "Personnel expense reimbursement requests",
      "Visual network map demonstrations",
      "Legal pages: Privacy Policy, Terms of Service, EULA, Copyright",
    ],
  },
];

const techStack = [
  { name: "React", description: "Frontend framework" },
  { name: "TypeScript", description: "Type-safe JavaScript" },
  { name: "Vite", description: "Build tool" },
  { name: "Tailwind CSS", description: "Styling" },
  { name: "shadcn/ui", description: "UI components" },
  { name: "TanStack Query", description: "Data fetching" },
  { name: "Supabase", description: "Database & Auth" },
  { name: "Capacitor", description: "Mobile apps" },
  { name: "Electron", description: "Desktop apps" },
  { name: "Twilio", description: "SMS messaging" },
  { name: "QuickBooks API", description: "Accounting integration" },
];

const Features = () => {
  return (
    <>
      <SEO
        title="Features"
        description="Command X - Complete construction workforce and project management platform. Manage personnel, projects, finances, and operations across iOS, Android, macOS, Windows, and Web."
        keywords="construction management, workforce management, project tracking, time clock, invoicing, estimates, QuickBooks integration"
      />
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 font-heading">
              Command X
            </h1>
            <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto">
              Complete Construction Workforce & Project Management Platform
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
                <Globe className="h-4 w-4" /> Web
              </span>
              <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
                <Smartphone className="h-4 w-4" /> iOS
              </span>
              <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
                <Smartphone className="h-4 w-4" /> Android
              </span>
              <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
                <LayoutDashboard className="h-4 w-4" /> macOS
              </span>
              <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full">
                <LayoutDashboard className="h-4 w-4" /> Windows
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="border-b border-border">
          <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary">50+</div>
                <div className="text-sm text-muted-foreground">Features</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">5</div>
                <div className="text-sm text-muted-foreground">Platforms</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">4</div>
                <div className="text-sm text-muted-foreground">User Portals</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">2-Way</div>
                <div className="text-sm text-muted-foreground">QuickBooks Sync</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Categories */}
        <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
            Complete Feature Overview
          </h2>
          
          <Accordion type="multiple" className="space-y-4">
            {featureCategories.map((category) => (
              <AccordionItem
                key={category.id}
                value={category.id}
                className="border border-border rounded-lg overflow-hidden bg-card"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-center gap-4 text-left">
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{category.title}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <ul className="grid sm:grid-cols-2 gap-2 pt-2">
                    {category.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="text-primary mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Tech Stack */}
        <div className="bg-muted/30 border-t border-border">
          <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
              Built With Modern Technology
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {techStack.map((tech) => (
                <div
                  key={tech.name}
                  className="bg-background border border-border rounded-lg px-4 py-2 text-center"
                >
                  <div className="font-medium text-foreground">{tech.name}</div>
                  <div className="text-xs text-muted-foreground">{tech.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center text-sm text-muted-foreground">
            <p className="mb-4">
              © {new Date().getFullYear()} Fairfield. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/legal/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </a>
              <a href="/legal/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </a>
              <a href="/legal/eula" className="hover:text-foreground transition-colors">
                EULA
              </a>
              <a href="/legal/copyright" className="hover:text-foreground transition-colors">
                Copyright
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Features;
