import { lazy, Suspense } from "react";
import { RouteSkeleton } from "@/components/layout/RouteSkeleton";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Detect if running in Electron - HashRouter is required for file:// protocol
const isElectron =
  typeof window !== "undefined" && window.electronAPI?.isElectron;
const Router = isElectron ? HashRouter : BrowserRouter;

import { AuthProvider } from "@/contexts/AuthContext";
import { AIAssistantProvider } from "@/contexts/AIAssistantContext";
import { LocationTrackingProvider } from "@/contexts/LocationTrackingContext";
import { UIDensityProvider } from "@/contexts/UIDensityContext";
import { MessageDrawerProvider } from "@/contexts/MessageDrawerContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeSync } from "@/components/ThemeSync";


import { NetSuiteLayout } from "@/components/layout/netsuite/NetSuiteLayout";
import { useNativeStatusBar } from "@/hooks/useNativeStatusBar";
import { ChatInterface } from "@/components/ai-assistant/ChatInterface";
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const DesktopCallback = lazy(() => import("./pages/DesktopCallback"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const Products = lazy(() => import("./pages/Products"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Projects = lazy(() => import("./pages/Projects"));
const EventManager = lazy(() => import("./pages/EventManager"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const LocationDetail = lazy(() => import("./pages/LocationDetail"));
const Locations = lazy(() => import("./pages/Locations"));
const ProjectJoin = lazy(() => import("./pages/ProjectJoin"));
const CustomerPortal = lazy(() => import("./pages/CustomerPortal"));
const AgencyPortal = lazy(() => import("./pages/AgencyPortal"));
const FieldMode = lazy(() => import("./pages/FieldMode"));
const FieldHome = lazy(() => import("./pages/FieldHome"));
const Vendors = lazy(() => import("./pages/Vendors"));
const VendorDetail = lazy(() => import("./pages/VendorDetail"));
const VendorBills = lazy(() => import("./pages/VendorBills"));
const VendorBillDetail = lazy(() => import("./pages/VendorBillDetail"));
const NewVendorBill = lazy(() => import("./pages/NewVendorBill"));
const EditVendorBill = lazy(() => import("./pages/EditVendorBill"));
const VendorDocuments = lazy(() => import("./pages/VendorDocuments"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Sales = lazy(() => import("./pages/Sales"));
const Estimates = lazy(() => import("./pages/Estimates"));
const NewEstimate = lazy(() => import("./pages/NewEstimate"));
const EstimateDetail = lazy(() => import("./pages/EstimateDetail"));
const EditEstimate = lazy(() => import("./pages/EditEstimate"));
// JobOrders page removed - job orders are now accessed through ProjectDetail
const JobOrderDetail = lazy(() => import("./pages/JobOrderDetail"));
const EditJobOrder = lazy(() => import("./pages/EditJobOrder"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const NewPurchaseOrder = lazy(() => import("./pages/NewPurchaseOrder"));
const PurchaseOrderDetail = lazy(() => import("./pages/PurchaseOrderDetail"));
const EditPurchaseOrder = lazy(() => import("./pages/EditPurchaseOrder"));
const Invoices = lazy(() => import("./pages/Invoices"));
const NewInvoice = lazy(() => import("./pages/NewInvoice"));
const NewTimeEntryInvoice = lazy(() => import("./pages/NewTimeEntryInvoice"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const EditInvoice = lazy(() => import("./pages/EditInvoice"));
const TimeTracking = lazy(() => import("./pages/TimeTracking"));
const OverheadAnalysis = lazy(() => import("./pages/OverheadAnalysis"));
const Reports = lazy(() => import("./pages/Reports"));
const TeamTimesheet = lazy(() => import("./pages/TeamTimesheet"));
const Reimbursements = lazy(() => import("./pages/Reimbursements"));
const ProjectAssignments = lazy(() => import("./pages/ProjectAssignments"));
const Settings = lazy(() => import("./pages/Settings"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const ApproveEstimate = lazy(() => import("./pages/ApproveEstimate"));
const Personnel = lazy(() => import("./pages/Personnel"));
const PersonnelDetail = lazy(() => import("./pages/PersonnelDetail"));
const PersonnelRegistrationPortal = lazy(() => import("./pages/PersonnelRegistrationPortal"));
const PersonnelInviteRegister = lazy(() => import("./pages/PersonnelInviteRegister"));
const BadgeTemplates = lazy(() => import("./pages/BadgeTemplates"));
const BadgeTemplateEditor = lazy(() => import("./pages/BadgeTemplateEditor"));
const QuickBooksSettings = lazy(() => import("./pages/QuickBooksSettings"));
const ExpenseCategories = lazy(() => import("./pages/ExpenseCategories"));
const Messages = lazy(() => import("./pages/Messages"));
const Conversations = lazy(() => import("./pages/Conversations"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const EULA = lazy(() => import("./pages/legal/EULA"));
const Copyright = lazy(() => import("./pages/legal/Copyright"));
const Features = lazy(() => import("./pages/Features"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const PortalHours = lazy(() => import("./pages/portal/PortalHours"));
const PortalProjects = lazy(() => import("./pages/portal/PortalProjects"));
const PortalProjectDetail = lazy(() => import("./pages/portal/PortalProjectDetail"));
const PortalAssets = lazy(() => import("./pages/portal/PortalAssets"));
const PortalDocuments = lazy(() => import("./pages/portal/PortalDocuments"));
const PortalReimbursements = lazy(() => import("./pages/portal/PortalReimbursements"));
const PortalNotifications = lazy(() => import("./pages/portal/PortalNotifications"));
const PortalSettings = lazy(() => import("./pages/portal/PortalSettings"));
const PortalBanking = lazy(() => import("./pages/portal/PortalBanking"));
const PortalTaxForms = lazy(() => import("./pages/portal/PortalTaxForms"));
const PortalTimeClock = lazy(() => import("./pages/portal/PortalTimeClock"));
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const AcceptPortalInvitation = lazy(() => import("./pages/portal/AcceptPortalInvitation"));
import { PortalProtectedRoute } from "./components/portal/PortalProtectedRoute";
const ContractorPortal = lazy(() => import("./pages/contractor/ContractorPortal"));
const ContractorSubmissionSuccess = lazy(() => import("./pages/contractor/ContractorSubmissionSuccess"));
const ContractorSubmissions = lazy(() => import("./pages/admin/ContractorSubmissions"));
const ContractorFormBuilder = lazy(() => import("./pages/admin/ContractorFormBuilder"));
const VendorPortalPreview = lazy(() => import("./pages/admin/VendorPortalPreview"));
const PersonnelPortalPreview = lazy(() => import("./pages/admin/PersonnelPortalPreview"));
const PermissionsManagement = lazy(() => import("./pages/PermissionsManagement"));
const StaffingMapView = lazy(() => import("./pages/StaffingMapView"));

// Vendor Portal
import { VendorProtectedRoute } from "./components/vendor-portal/VendorProtectedRoute";
const VendorLogin = lazy(() => import("./pages/vendor-portal/VendorLogin"));
const AcceptVendorInvitation = lazy(() => import("./pages/vendor-portal/AcceptVendorInvitation"));
const VendorDashboard = lazy(() => import("./pages/vendor-portal/VendorDashboard"));
const VendorPOsList = lazy(() => import("./pages/vendor-portal/VendorPOsList"));
const VendorPODetail = lazy(() => import("./pages/vendor-portal/VendorPODetail"));
const VendorBillsList = lazy(() => import("./pages/vendor-portal/VendorBillsList"));
const VendorPortalBillDetail = lazy(() => import("./pages/vendor-portal/VendorBillDetail"));
const VendorNewBill = lazy(() => import("./pages/vendor-portal/VendorNewBill"));
const VendorSettings = lazy(() => import("./pages/vendor-portal/VendorSettings"));

// Subcontractor Portal
import { SubcontractorProtectedRoute } from "./components/subcontractor-portal/SubcontractorProtectedRoute";
const SubcontractorLogin = lazy(() => import("./pages/subcontractor-portal/SubcontractorLogin"));
const SubcontractorDashboard = lazy(() => import("./pages/subcontractor-portal/SubcontractorDashboard"));
const SubcontractorPOList = lazy(() => import("./pages/subcontractor-portal/SubcontractorPOList"));
const SubcontractorPODetail = lazy(() => import("./pages/subcontractor-portal/SubcontractorPODetail"));
const SubcontractorBillsList = lazy(() => import("./pages/subcontractor-portal/SubcontractorBillsList"));
const SubcontractorBillDetail = lazy(() => import("./pages/subcontractor-portal/SubcontractorBillDetail"));
const SubcontractorNewBill = lazy(() => import("./pages/subcontractor-portal/SubcontractorNewBill"));
const SubcontractorCompletions = lazy(() => import("./pages/subcontractor-portal/SubcontractorCompletions"));
const SubcontractorCompletionDetail = lazy(() => import("./pages/subcontractor-portal/SubcontractorCompletionDetail"));
const SubcontractorCompletionHistory = lazy(() => import("./pages/subcontractor-portal/SubcontractorCompletionHistory"));
const CompletionReviews = lazy(() => import("./pages/CompletionReviews"));

const NewChangeOrder = lazy(() => import("./pages/NewChangeOrder"));
const EditChangeOrder = lazy(() => import("./pages/EditChangeOrder"));
const ChangeOrderDetail = lazy(() => import("./pages/ChangeOrderDetail"));
const ApproveChangeOrder = lazy(() => import("./pages/ApproveChangeOrder"));
const ApproveChangeOrderPublic = lazy(() => import("./pages/ApproveChangeOrderPublic"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const StaffingApplications = lazy(() => import("./pages/StaffingApplications"));
const JobPostingEntries = lazy(() => import("./pages/JobPostingEntries"));
const PublicApplicationForm = lazy(() => import("./pages/PublicApplicationForm"));
const PhotoRequest = lazy(() => import("./pages/PhotoRequest"));
const SitePunch = lazy(() => import("./pages/SitePunch"));
const Kiosk = lazy(() => import("./pages/Kiosk"));
import { SheetReopenDialog } from '@/components/signin/SheetReopenDialog';
const DocumentSign = lazy(() => import("./pages/DocumentSign"));
const TimesheetSign = lazy(() => import("./pages/TimesheetSign"));
const QuickApply = lazy(() => import("./pages/QuickApply"));
const MasterApplicants = lazy(() => import("./pages/MasterApplicants"));
const Workforce = lazy(() => import("./pages/Workforce"));
const Duplicates = lazy(() => import("./pages/Duplicates"));
const EditApplication = lazy(() => import("./pages/EditApplication"));
const ApplicationFormTemplates = lazy(() => import("./pages/ApplicationFormTemplates"));
const ApplicationFormBuilder = lazy(() => import("./pages/ApplicationFormBuilder"));
const PersonnelOnboarding = lazy(() => import("./pages/PersonnelOnboarding"));
import { ErrorBoundary } from "./components/ErrorBoundary";
const OnboardingComplete = lazy(() => import("./pages/OnboardingComplete"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const SessionHistory = lazy(() => import("./pages/SessionHistory"));
const ActivityHistory = lazy(() => import("./pages/ActivityHistory"));
const AiDevAssistant = lazy(() => import("./pages/admin/AiDevAssistant"));
const Trash = lazy(() => import("./pages/admin/Trash"));
const W9Preview = lazy(() => import("./pages/admin/W9Preview"));
const DocumentCenter = lazy(() => import("./pages/DocumentCenter"));
import { UpdateNotification } from "./components/electron/UpdateNotification";
const NetworkMapDemo = lazy(() => import("./pages/NetworkMapDemo"));
const USANetworkMapDemo = lazy(() => import("./pages/USANetworkMapDemo"));
const VendorOnboarding = lazy(() => import("./pages/VendorOnboarding"));
const VendorOnboardingComplete = lazy(() => import("./pages/VendorOnboardingComplete"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});
// Rarely-changing lookups: reuse for 5 minutes; mutations still invalidate them.
for (const key of ["customers", "vendors", "projects", "products", "expense-categories"]) {
  queryClient.setQueryDefaults([key], { staleTime: 5 * 60_000 });
}

const clearOnboardingDrafts = () => {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("onboarding-progress-"))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch (error) {
    console.warn("[Onboarding] Failed to clear local onboarding draft:", error);
  }
};

// Wrapper component to use status bar hook inside ThemeProvider
const NativeStatusBarManager = () => {
  useNativeStatusBar();
  return null;
};

const App = () => {
  return (

    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NativeStatusBarManager />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SheetReopenDialog />
          <Router>
            <AuthProvider>
              <ThemeSync />
              <LocationTrackingProvider>
                <AIAssistantProvider>
                  <MessageDrawerProvider>
                  <Suspense fallback={<RouteSkeleton />}><Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route
                      path="/auth/desktop-callback"
                      element={<DesktopCallback />}
                    />
                    <Route path="/unauthorized" element={<Unauthorized />} />
                    <Route
                      path="/accept-invitation"
                      element={<AcceptInvitation />}
                    />
                    <Route
                      path="/approve-estimate/:token"
                      element={<ApproveEstimate />}
                    />
                    <Route
                      path="/approve-change-order/:token"
                      element={<ApproveChangeOrder />}
                    />
                    <Route
                      path="/approve-co/:token"
                      element={<ApproveChangeOrderPublic />}
                    />
                    <Route
                      path="/personnel/register"
                      element={<PersonnelRegistrationPortal />}
                    />
                    <Route
                      path="/register/:token"
                      element={<PersonnelInviteRegister />}
                    />
                    <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                    <Route path="/legal/terms" element={<TermsOfService />} />
                    <Route path="/legal/eula" element={<EULA />} />
                    <Route path="/legal/copyright" element={<Copyright />} />
                    <Route path="/features" element={<Features />} />
                    {/* Public Application Form */}
                    <Route
                      path="/apply/:token"
                      element={<PublicApplicationForm />}
                    />
                    <Route
                      path="/apply/edit/:editToken"
                      element={<EditApplication />}
                    />
                    <Route path="/photo/:token" element={<PhotoRequest />} />
                    <Route path="/punch/:token" element={<SitePunch />} />
                    <Route path="/join/:token" element={<ProjectJoin />} />
                    <Route path="/customer/:token" element={<CustomerPortal />} />
                    <Route path="/agency/:token" element={<AgencyPortal />} />
                    <Route path="/kiosk/:token" element={<Kiosk />} />
                    <Route path="/sign/:token" element={<DocumentSign />} />
                    <Route path="/timesheet-sign/:token" element={<TimesheetSign />} />
                    <Route path="/quick-apply/:token" element={<QuickApply />} />
                    {/* Onboarding Routes */}
                    <Route
                      path="/onboard/:token"
                      element={
                        <ErrorBoundary
                          fallbackTitle="Onboarding hit a snag"
                          fallbackMessage="Tap Try Again to reset the local draft and continue."
                          onBeforeRetry={clearOnboardingDrafts}
                        >
                          <PersonnelOnboarding />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/onboarding-complete/:token"
                      element={<OnboardingComplete />}
                    />
                    {/* Vendor Onboarding Routes */}
                    <Route
                      path="/vendor-onboarding/:token"
                      element={<VendorOnboarding />}
                    />
                    <Route
                      path="/vendor-onboarding-complete"
                      element={<VendorOnboardingComplete />}
                    />
                    {/* Public Contractor Routes */}
                    <Route path="/contractor" element={<ContractorPortal />} />
                    <Route
                      path="/contractor/success"
                      element={<ContractorSubmissionSuccess />}
                    />
                    {/* Network Map Demo */}
                    <Route
                      path="/network-map-demo"
                      element={<NetworkMapDemo />}
                    />
                    <Route
                      path="/usa-network-map-demo"
                      element={<USANetworkMapDemo />}
                    />
                    {/* Admin Contractor Routes - moved to SidebarLayout group below */}
                    {/* Portal Routes */}
                    <Route path="/portal/login" element={<PortalLogin />} />
                    <Route
                      path="/portal/accept-invite/:token"
                      element={<AcceptPortalInvitation />}
                    />
                    <Route
                      path="/portal"
                      element={
                        <PortalProtectedRoute>
                          <PortalDashboard />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/time-clock"
                      element={
                        <PortalProtectedRoute>
                          <PortalTimeClock />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/hours"
                      element={
                        <PortalProtectedRoute>
                          <PortalHours />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/projects"
                      element={
                        <PortalProtectedRoute>
                          <PortalProjects />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/projects/:id"
                      element={
                        <PortalProtectedRoute>
                          <PortalProjectDetail />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/documents"
                      element={
                        <PortalProtectedRoute>
                          <PortalDocuments />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/reimbursements"
                      element={
                        <PortalProtectedRoute>
                          <PortalReimbursements />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/notifications"
                      element={
                        <PortalProtectedRoute>
                          <PortalNotifications />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/tax-forms"
                      element={
                        <PortalProtectedRoute>
                          <PortalTaxForms />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/assets"
                      element={
                        <PortalProtectedRoute>
                          <PortalAssets />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/settings"
                      element={
                        <PortalProtectedRoute>
                          <PortalSettings />
                        </PortalProtectedRoute>
                      }
                    />
                    <Route
                      path="/portal/banking"
                      element={
                        <PortalProtectedRoute>
                          <PortalBanking />
                        </PortalProtectedRoute>
                      }
                    />
                    {/* Protected Routes with NetSuite Layout */}
                    <Route
                      element={
                        <ProtectedRoute>
                          <UIDensityProvider>
                            <NetSuiteLayout />
                          </UIDensityProvider>
                        </ProtectedRoute>
                      }
                    >
                      <Route path="/" element={<Index />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route
                        path="/customers/:id"
                        element={<CustomerDetail />}
                      />
                      <Route path="/projects" element={<Projects />} />
                      <Route path="/locations" element={<Locations />} />
                      <Route path="/events" element={<EventManager />} />
                      <Route path="/events/:campId" element={<EventManager />} />
                      <Route path="/projects/:id" element={<ProjectDetail />} />
                      <Route path="/projects/:projectId/locations/:locationId" element={<LocationDetail />} />
                      <Route path="/field/:projectId" element={<FieldMode />} />
                      <Route path="/field" element={<FieldHome />} />
                      <Route path="/vendors" element={<Vendors />} />
                      <Route path="/vendors/:id" element={<VendorDetail />} />
                      <Route path="/vendor-bills" element={<VendorBills />} />
                      <Route
                        path="/vendor-bills/new"
                        element={<NewVendorBill />}
                      />
                      <Route
                        path="/vendor-bills/:id"
                        element={<VendorBillDetail />}
                      />
                      <Route
                        path="/vendor-bills/:id/edit"
                        element={<EditVendorBill />}
                      />
                      <Route
                        path="/vendor-documents"
                        element={<VendorDocuments />}
                      />
                      <Route path="/jobs" element={<Jobs />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/estimates" element={<Estimates />} />
                      <Route path="/estimates/new" element={<NewEstimate />} />
                      <Route
                        path="/estimates/:id"
                        element={<EstimateDetail />}
                      />
                      <Route
                        path="/estimates/:id/edit"
                        element={<EditEstimate />}
                      />
                      {/* Job orders are accessed through project detail - standalone list removed */}
                      <Route
                        path="/job-orders/:id"
                        element={<JobOrderDetail />}
                      />
                      <Route
                        path="/job-orders/:id/edit"
                        element={<EditJobOrder />}
                      />
                      <Route
                        path="/purchase-orders"
                        element={<PurchaseOrders />}
                      />
                      <Route
                        path="/purchase-orders/new"
                        element={<NewPurchaseOrder />}
                      />
                      <Route
                        path="/purchase-orders/:id"
                        element={<PurchaseOrderDetail />}
                      />
                      <Route
                        path="/change-orders/new"
                        element={<NewChangeOrder />}
                      />
                      <Route
                        path="/change-orders/:id"
                        element={<ChangeOrderDetail />}
                      />
                      <Route
                        path="/change-orders/:id/edit"
                        element={<EditChangeOrder />}
                      />
                      <Route
                        path="/purchase-orders/:id/edit"
                        element={<EditPurchaseOrder />}
                      />
                      <Route path="/invoices" element={<Invoices />} />
                      <Route path="/invoices/new" element={<NewInvoice />} />
                      <Route
                        path="/invoices/new-from-time"
                        element={<NewTimeEntryInvoice />}
                      />
                      <Route path="/invoices/:id" element={<InvoiceDetail />} />
                      <Route
                        path="/invoices/:id/edit"
                        element={<EditInvoice />}
                      />
                      <Route path="/time-tracking" element={<TimeTracking />} />
                      <Route path="/overhead-analysis" element={<OverheadAnalysis />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route
                        path="/team-timesheet"
                        element={<TeamTimesheet />}
                      />
                      <Route
                        path="/reimbursements"
                        element={<Reimbursements />}
                      />
                      <Route
                        path="/project-assignments"
                        element={<ProjectAssignments />}
                      />
                      <Route path="/personnel" element={<Personnel />} />
                      <Route
                        path="/personnel/:id"
                        element={<PersonnelDetail />}
                      />
                      <Route
                        path="/badge-templates"
                        element={<BadgeTemplates />}
                      />
                      <Route
                        path="/badge-templates/:id"
                        element={<BadgeTemplateEditor />}
                      />
                      <Route path="/settings" element={<Settings />} />
                      <Route
                        path="/document-center"
                        element={<DocumentCenter />}
                      />
                      <Route
                        path="/user-management"
                        element={<UserManagement />}
                      />
                      <Route
                        path="/permissions"
                        element={<PermissionsManagement />}
                      />
                      <Route
                        path="/settings/quickbooks"
                        element={<QuickBooksSettings />}
                      />
                      <Route
                        path="/settings/expense-categories"
                        element={<ExpenseCategories />}
                      />
                      <Route path="/messages" element={<Messages />} />
                      <Route
                        path="/conversations"
                        element={<Navigate to="/messages" replace />}
                      />
                      <Route
                        path="/notifications"
                        element={<AdminNotifications />}
                      />
                      <Route
                        path="/admin/contractor-submissions"
                        element={<ContractorSubmissions />}
                      />
                      <Route
                        path="/admin/contractor-form-builder"
                        element={<ContractorFormBuilder />}
                      />
                      <Route
                        path="/admin/preview/vendor-portal"
                        element={<VendorPortalPreview />}
                      />
                      <Route
                        path="/admin/preview/personnel-portal"
                        element={<PersonnelPortalPreview />}
                      />
                      <Route
                        path="/admin/preview/w9"
                        element={<W9Preview />}
                      />
                      <Route path="/admin/audit-logs" element={<AuditLogs />} />
                      <Route
                        path="/admin"
                        element={<Navigate to="/" replace />}
                      />
                      <Route path="/admin/trash" element={<Trash />} />
                      <Route
                        path="/staffing/applications"
                        element={<StaffingApplications />}
                      />
                      <Route
                        path="/staffing/applicants"
                        element={<MasterApplicants />}
                      />
                      <Route path="/workforce" element={<Workforce />} />
                      <Route
                        path="/staffing/duplicates"
                        element={<Duplicates />}
                      />
                      <Route
                        path="/staffing/applications/posting/:postingId"
                        element={<JobPostingEntries />}
                      />
                      <Route
                        path="/staffing/form-templates"
                        element={<ApplicationFormTemplates />}
                      />
                      <Route
                        path="/staffing/form-templates/new"
                        element={<ApplicationFormBuilder />}
                      />
                      <Route
                        path="/staffing/form-templates/:id"
                        element={<ApplicationFormBuilder />}
                      />
                      <Route
                        path="/staffing/map"
                        element={<StaffingMapView />}
                      />
                      <Route
                        path="/session-history"
                        element={<SessionHistory />}
                      />
                      <Route
                        path="/activity-history"
                        element={<ActivityHistory />}
                      />
                      <Route path="/ai-dev" element={<AiDevAssistant />} />
                    </Route>

                    {/* Vendor Portal Routes */}
                    <Route path="/vendor/login" element={<VendorLogin />} />
                    <Route
                      path="/vendor/accept-invite/:token"
                      element={<AcceptVendorInvitation />}
                    />
                    <Route
                      path="/vendor"
                      element={
                        <VendorProtectedRoute>
                          <VendorDashboard />
                        </VendorProtectedRoute>
                      }
                    />
                    <Route
                      path="/vendor/pos"
                      element={
                        <VendorProtectedRoute>
                          <VendorPOsList />
                        </VendorProtectedRoute>
                      }
                    />
                    <Route
                      path="/vendor/pos/:id"
                      element={
                        <VendorProtectedRoute>
                          <VendorPODetail />
                        </VendorProtectedRoute>
                      }
                    />
                    <Route
                      path="/vendor/bills"
                      element={
                        <VendorProtectedRoute>
                          <VendorBillsList />
                        </VendorProtectedRoute>
                      }
                    />
                    <Route
                      path="/vendor/bills/new"
                      element={
                        <VendorProtectedRoute>
                          <VendorNewBill />
                        </VendorProtectedRoute>
                      }
                    />
                    <Route
                      path="/vendor/bills/:id"
                      element={
                        <VendorProtectedRoute>
                          <VendorPortalBillDetail />
                        </VendorProtectedRoute>
                      }
                    />
                    <Route
                      path="/vendor/settings"
                      element={
                        <VendorProtectedRoute>
                          <VendorSettings />
                        </VendorProtectedRoute>
                      }
                    />

                    {/* Subcontractor Portal Routes */}
                    <Route
                      path="/subcontractor/login"
                      element={<SubcontractorLogin />}
                    />
                    <Route
                      path="/subcontractor"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorDashboard />
                        </SubcontractorProtectedRoute>
                      }
                    />
                    <Route
                      path="/subcontractor/purchase-orders"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorPOList />
                        </SubcontractorProtectedRoute>
                      }
                    />
                    <Route
                      path="/subcontractor/purchase-orders/:id"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorPODetail />
                        </SubcontractorProtectedRoute>
                      }
                    />
                    <Route
                      path="/subcontractor/bills"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorBillsList />
                        </SubcontractorProtectedRoute>
                      }
                    />
                    <Route
                      path="/subcontractor/bills/new"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorNewBill />
                        </SubcontractorProtectedRoute>
                      }
                    />
                    <Route
                      path="/subcontractor/bills/:id"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorBillDetail />
                        </SubcontractorProtectedRoute>
                      }
                    />
                    <Route
                      path="/subcontractor/completions"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorCompletions />
                        </SubcontractorProtectedRoute>
                      }
                    />
                    <Route
                      path="/subcontractor/completions/history"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorCompletionHistory />
                        </SubcontractorProtectedRoute>
                      }
                    />
                    <Route
                      path="/subcontractor/completions/:id"
                      element={
                        <SubcontractorProtectedRoute>
                          <SubcontractorCompletionDetail />
                        </SubcontractorProtectedRoute>
                      }
                    />

                    {/* Admin: Completion Reviews */}
                    <Route
                      path="/completion-reviews"
                      element={
                        <ProtectedRoute>
                          <CompletionReviews />
                        </ProtectedRoute>
                      }
                    />

                    <Route path="*" element={<NotFound />} />
                  </Routes></Suspense>

                  <ChatInterface />
                  <UpdateNotification />
                  </MessageDrawerProvider>
                </AIAssistantProvider>
              </LocationTrackingProvider>
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
