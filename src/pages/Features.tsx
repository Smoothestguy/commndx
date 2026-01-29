import { SEO } from "@/components/SEO";
import commandXLogo from "@/assets/command-x-logo.png";
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
  MapPin,
  CreditCard,
  Globe,
  Eye,
  Zap
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface FeatureCategory {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  features: { text: string; highlight?: string }[];
}

interface KeyBenefit {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const keyBenefits: KeyBenefit[] = [
  {
    icon: <Clock className="h-8 w-8" />,
    title: "Save Hours Every Week",
    description: "Automated invoicing and two-way QuickBooks sync eliminate double-entry and manual data transfers",
  },
  {
    icon: <MapPin className="h-8 w-8" />,
    title: "Accurate, Verified Payroll",
    description: "GPS-verified time clocks with geofencing ensure workers clock in from the job site, not their couch",
  },
  {
    icon: <CreditCard className="h-8 w-8" />,
    title: "Get Paid Faster",
    description: "Digital estimate approvals, progress billing, and invoice workflows accelerate your cash flow",
  },
  {
    icon: <Eye className="h-8 w-8" />,
    title: "Complete Project Visibility",
    description: "Real-time dashboards show costs, progress, and staffing so you always know where things stand",
  },
  {
    icon: <Users className="h-8 w-8" />,
    title: "Streamlined Crew Management",
    description: "From self-registration to W-9s and electronic signatures, onboard and manage your workforce digitally",
  },
];

const featureCategories: FeatureCategory[] = [
  {
    id: "dashboard",
    icon: <LayoutDashboard className="h-6 w-6" />,
    title: "Dashboard & KPIs",
    description: "Stop guessing, start knowing. See revenue, projects, and staffing at a glance",
    features: [
      { text: "Customizable widget-based dashboard" },
      { text: "Real-time KPI stats (revenue, active projects, staffing, pending invoices)" },
      { text: "Activity feed showing recent actions" },
      { text: "Quick action buttons for common tasks" },
      { text: "Welcome banner with user greeting" },
      { text: "Trash widget to recover deleted items" },
    ],
  },
  {
    id: "projects",
    icon: <FolderKanban className="h-6 w-6" />,
    title: "Project Management",
    description: "End-to-end project lifecycle tracking from quote to completion",
    features: [
      { text: "Create and track projects with statuses: Quote, Task Order, Active, Complete, Canceled" },
      { text: "Individual vs Team project classification" },
      { text: "Personnel assignments to projects" },
      { text: "Site location with GPS coordinates and geofence radius", highlight: "Ensures on-site presence" },
      { text: "Project-level settings for time clock requirements" },
      { text: "Link to customers, estimates, job orders, invoices" },
    ],
  },
  {
    id: "customers",
    icon: <Users className="h-6 w-6" />,
    title: "Customer Management",
    description: "Comprehensive customer relationship tracking with QuickBooks sync",
    features: [
      { text: "Full customer database with contact details" },
      { text: "Company name, address, email, phone" },
      { text: "Link customers to projects and invoices" },
      { text: "Customer-specific estimates and job orders" },
      { text: "Sync with QuickBooks", highlight: "No double-entry" },
    ],
  },
  {
    id: "vendors",
    icon: <Building2 className="h-6 w-6" />,
    title: "Vendor Management",
    description: "Streamline vendor relationships, payments, and compliance",
    features: [
      { text: "Vendor database with contact information" },
      { text: "Vendor bills and payment tracking" },
      { text: "Document uploads per vendor" },
      { text: "Specialty and license number tracking" },
      { text: "Tax ID and 1099 tracking", highlight: "Stay compliant" },
      { text: "Vendor portal access management" },
      { text: "Sync with QuickBooks" },
    ],
  },
  {
    id: "financials",
    icon: <FileText className="h-6 w-6" />,
    title: "Financial Documents",
    description: "Get paid faster. Streamline the path from estimate to invoice to cash",
    features: [
      { text: "Estimates with line items, tax rates, and customer approval workflow", highlight: "Faster approvals" },
      { text: "Job Orders generated from approved estimates with progress billing" },
      { text: "Change Orders (additive/deductive) with customer approval" },
      { text: "Purchase Orders linked to vendors and job orders" },
      { text: "Invoices with progress billing and QuickBooks sync" },
      { text: "Vendor Bills with approval workflow and payment tracking" },
      { text: "Version history and attachment support" },
    ],
  },
  {
    id: "timeclock",
    icon: <Clock className="h-6 w-6" />,
    title: "Time & Attendance",
    description: "Eliminate buddy punching and payroll disputes with location-verified clock-ins",
    features: [
      { text: "Clock In/Out with GPS location capture" },
      { text: "Lunch break start/end with duration tracking" },
      { text: "Real-time hours calculation with sub-second precision" },
      { text: "Project-based time tracking" },
      { text: "GPS geofencing with configurable radius", highlight: "Prevents time theft" },
      { text: "Haversine formula for distance calculation" },
      { text: "Background location tracking on iOS/Android" },
      { text: "Auto-start on device boot" },
      { text: "Personal and team timesheet views" },
    ],
  },
  {
    id: "personnel",
    icon: <UserCheck className="h-6 w-6" />,
    title: "Personnel Management",
    description: "Hire to retire. Manage your crew with digital onboarding and compliance tracking",
    features: [
      { text: "Full personnel records with photo" },
      { text: "Contact information, address, SSN (masked)" },
      { text: "Citizenship and immigration status tracking" },
      { text: "Emergency contacts" },
      { text: "Hire date and employment type" },
      { text: "Hourly rate and pay type" },
      { text: "Status tracking: Active, Inactive, Terminated" },
      { text: "Public self-registration portal", highlight: "Self-service onboarding" },
      { text: "Token-based onboarding with W-9 and contractor agreements" },
      { text: "Electronic signature with scroll-to-read requirement" },
      { text: "Personnel ID badge templates and printing" },
    ],
  },
  {
    id: "messaging",
    icon: <MessageSquare className="h-6 w-6" />,
    title: "Messaging & Communications",
    description: "Keep field and office aligned with integrated SMS and in-app messaging",
    features: [
      { text: "SMS messaging via Twilio" },
      { text: "Message status tracking: Pending → Sent → Delivered → Failed" },
      { text: "Twilio webhook for receiving replies" },
      { text: "Conversation-based messaging threads" },
      { text: "Real-time typing indicators" },
      { text: "Read/delivered status indicators" },
      { text: "Bulk SMS to multiple recipients" },
      { text: "Automated assignment notifications", highlight: "Instant updates" },
    ],
  },
  {
    id: "quickbooks",
    icon: <RefreshCw className="h-6 w-6" />,
    title: "QuickBooks Integration",
    description: "End double-entry forever. Your books stay in sync automatically",
    features: [
      { text: "Products: Import/export product catalog" },
      { text: "Customers: Sync customer records" },
      { text: "Vendors: Sync with tax ID and 1099 tracking" },
      { text: "Invoices: Create and import invoices" },
      { text: "Estimates: Sync estimates" },
      { text: "Purchase Orders: Export POs" },
      { text: "Vendor Bills: Create bills in QuickBooks" },
      { text: "Batch processing with progress tracking" },
      { text: "Conflict detection and resolution" },
      { text: "Account mapping for expense categories", highlight: "Saves 5+ hours/week" },
    ],
  },
  {
    id: "staffing",
    icon: <Briefcase className="h-6 w-6" />,
    title: "Staffing & Recruiting",
    description: "End-to-end applicant tracking from job posting to hire",
    features: [
      { text: "Create task orders for projects" },
      { text: "Generate public job posting links" },
      { text: "Track headcount needed with location and start date" },
      { text: "Drag-and-drop form builder with custom themes" },
      { text: "Application status workflow: Submitted → Reviewing → Approved/Rejected" },
      { text: "Applicant details with photo and answer review" },
      { text: "Bulk actions and notes" },
      { text: "Export to CSV, Excel, PDF, JSON" },
      { text: "Contacted tracking and revoke approval" },
    ],
  },
  {
    id: "portals",
    icon: <DoorOpen className="h-6 w-6" />,
    title: "User Portals",
    description: "Dedicated self-service portals reduce admin workload",
    features: [
      { text: "Personnel Portal: Dashboard, time clock, hours history, documents, reimbursements, tax forms" },
      { text: "Vendor Portal: PO management, bill submission, payment tracking" },
      { text: "Subcontractor Portal: PO viewing, bill submission, back charges" },
      { text: "Contractor Portal: Public bill and expense submission with multi-language support" },
    ],
  },
  {
    id: "security",
    icon: <Shield className="h-6 w-6" />,
    title: "Security & Administration",
    description: "Enterprise-grade security and access control for peace of mind",
    features: [
      { text: "Email/password authentication" },
      { text: "OAuth: Google and Microsoft sign-in" },
      { text: "Invitation-based access" },
      { text: "Token-based portal access" },
      { text: "Role-based access: Admin, Manager, Accounting" },
      { text: "Granular permission controls" },
      { text: "Audit logs and user activity history" },
      { text: "Session history tracking" },
      { text: "Soft delete with trash recovery" },
    ],
  },
  {
    id: "platform",
    icon: <Smartphone className="h-6 w-6" />,
    title: "Platform Features",
    description: "Work from anywhere. Native apps for iOS, Android, macOS, Windows, and Web",
    features: [
      { text: "Web: React with responsive design" },
      { text: "iOS: Native Capacitor app" },
      { text: "Android: Native Capacitor app" },
      { text: "macOS: Electron desktop app with auto-updates" },
      { text: "Windows: Electron desktop app with auto-updates" },
      { text: "Dark/Light theme support" },
      { text: "Customizable dashboard widgets with drag-and-drop" },
      { text: "Density settings (spreadsheet, compact, normal, relaxed)" },
      { text: "Mobile-first responsive design with bottom navigation", highlight: "Field + office aligned" },
    ],
  },
  {
    id: "documents",
    icon: <FileArchive className="h-6 w-6" />,
    title: "Document Management",
    description: "Centralized document storage with role-based access control",
    features: [
      { text: "Centralized document storage" },
      { text: "Category-based organization" },
      { text: "File upload support" },
      { text: "Access control by role" },
      { text: "Attach files to estimates, invoices, POs" },
      { text: "Image lightbox preview" },
    ],
  },
  {
    id: "additional",
    icon: <Sparkles className="h-6 w-6" />,
    title: "Additional Features",
    description: "Extended functionality and tools to boost productivity",
    features: [
      { text: "AI Assistant for development support" },
      { text: "Personnel expense reimbursement requests" },
      { text: "Visual network map demonstrations" },
      { text: "Legal pages: Privacy Policy, Terms of Service, EULA, Copyright" },
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
            <img 
              src={commandXLogo} 
              alt="Command X Logo" 
              className="h-20 sm:h-28 mx-auto mb-6 invert dark:invert-0"
            />
            <p className="text-xl text-muted-foreground mb-4 max-w-3xl mx-auto">
              Complete Construction Workforce & Project Management Platform
            </p>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Manage your entire construction business from one platform. Track projects, personnel, 
              and finances with GPS-verified time clocks, automated invoicing, and seamless QuickBooks 
              integration. Built for field teams and back-office alike.
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
                        <span className="flex-1">
                          {feature.text}
                          {feature.highlight && (
                            <Badge variant="secondary" className="ml-2 text-xs font-normal">
                              {feature.highlight}
                            </Badge>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Key Benefits Section */}
        <div className="bg-primary/5 border-y border-border">
          <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <Zap className="h-4 w-4" />
                Why Construction Teams Choose Us
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Built to Solve Your Biggest Headaches
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {keyBenefits.map((benefit, index) => (
                <div
                  key={index}
                  className="bg-background border border-border rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="h-14 w-14 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                    {benefit.icon}
                  </div>
                  <h3 className="font-semibold text-foreground text-lg mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Social Proof Placeholder */}
        <div className="bg-muted/20 border-y border-border">
          <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-lg font-medium text-foreground mb-2">
              Trusted by construction teams across the country
            </p>
            <p className="text-sm text-muted-foreground">
              Join companies streamlining their workforce and project management
            </p>
          </div>
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
