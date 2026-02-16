import { useState } from "react";
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
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { AIAssistantProvider } from "@/contexts/AIAssistantContext";
import { LocationTrackingProvider } from "@/contexts/LocationTrackingContext";
import { UIDensityProvider } from "@/contexts/UIDensityContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BottomNav } from "@/components/layout/BottomNav";
import { MoreMenu } from "@/components/layout/MoreMenu";
import { NetSuiteLayout } from "@/components/layout/netsuite/NetSuiteLayout";
import { useNativeStatusBar } from "@/hooks/useNativeStatusBar";
import { ChatInterface } from "@/components/ai-assistant/ChatInterface";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import DesktopCallback from "./pages/DesktopCallback";
import Unauthorized from "./pages/Unauthorized";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import VendorBills from "./pages/VendorBills";
import VendorBillDetail from "./pages/VendorBillDetail";
import NewVendorBill from "./pages/NewVendorBill";
import EditVendorBill from "./pages/EditVendorBill";
import VendorDocuments from "./pages/VendorDocuments";
import Jobs from "./pages/Jobs";
import Sales from "./pages/Sales";
import Estimates from "./pages/Estimates";
import NewEstimate from "./pages/NewEstimate";
import EstimateDetail from "./pages/EstimateDetail";
import EditEstimate from "./pages/EditEstimate";
// JobOrders page removed - job orders are now accessed through ProjectDetail
import JobOrderDetail from "./pages/JobOrderDetail";
import EditJobOrder from "./pages/EditJobOrder";
import PurchaseOrders from "./pages/PurchaseOrders";
import NewPurchaseOrder from "./pages/NewPurchaseOrder";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import EditPurchaseOrder from "./pages/EditPurchaseOrder";
import Invoices from "./pages/Invoices";
import NewInvoice from "./pages/NewInvoice";
import NewTimeEntryInvoice from "./pages/NewTimeEntryInvoice";
import InvoiceDetail from "./pages/InvoiceDetail";
import EditInvoice from "./pages/EditInvoice";
import TimeTracking from "./pages/TimeTracking";
import OverheadAnalysis from "./pages/OverheadAnalysis";
import TeamTimesheet from "./pages/TeamTimesheet";
import Reimbursements from "./pages/Reimbursements";
import ProjectAssignments from "./pages/ProjectAssignments";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import AcceptInvitation from "./pages/AcceptInvitation";
import ApproveEstimate from "./pages/ApproveEstimate";
import Personnel from "./pages/Personnel";
import PersonnelDetail from "./pages/PersonnelDetail";
import PersonnelRegistrationPortal from "./pages/PersonnelRegistrationPortal";
import PersonnelInviteRegister from "./pages/PersonnelInviteRegister";
import BadgeTemplates from "./pages/BadgeTemplates";
import BadgeTemplateEditor from "./pages/BadgeTemplateEditor";
import QuickBooksSettings from "./pages/QuickBooksSettings";
import ExpenseCategories from "./pages/ExpenseCategories";
import Messages from "./pages/Messages";
import Conversations from "./pages/Conversations";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import EULA from "./pages/legal/EULA";
import Copyright from "./pages/legal/Copyright";
import Features from "./pages/Features";
import NotFound from "./pages/NotFound";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalHours from "./pages/portal/PortalHours";
import PortalProjects from "./pages/portal/PortalProjects";
import PortalProjectDetail from "./pages/portal/PortalProjectDetail";
import PortalAssets from "./pages/portal/PortalAssets";
import PortalDocuments from "./pages/portal/PortalDocuments";
import PortalReimbursements from "./pages/portal/PortalReimbursements";
import PortalNotifications from "./pages/portal/PortalNotifications";
import PortalSettings from "./pages/portal/PortalSettings";
import PortalTaxForms from "./pages/portal/PortalTaxForms";
import PortalTimeClock from "./pages/portal/PortalTimeClock";
import PortalLogin from "./pages/portal/PortalLogin";
import AcceptPortalInvitation from "./pages/portal/AcceptPortalInvitation";
import { PortalProtectedRoute } from "./components/portal/PortalProtectedRoute";
import ContractorPortal from "./pages/contractor/ContractorPortal";
import ContractorSubmissionSuccess from "./pages/contractor/ContractorSubmissionSuccess";
import ContractorSubmissions from "./pages/admin/ContractorSubmissions";
import ContractorFormBuilder from "./pages/admin/ContractorFormBuilder";
import VendorPortalPreview from "./pages/admin/VendorPortalPreview";
import PersonnelPortalPreview from "./pages/admin/PersonnelPortalPreview";
import PermissionsManagement from "./pages/PermissionsManagement";
import StaffingMapView from "./pages/StaffingMapView";

// Vendor Portal
import { VendorProtectedRoute } from "./components/vendor-portal/VendorProtectedRoute";
import VendorLogin from "./pages/vendor-portal/VendorLogin";
import AcceptVendorInvitation from "./pages/vendor-portal/AcceptVendorInvitation";
import VendorDashboard from "./pages/vendor-portal/VendorDashboard";
import VendorPOsList from "./pages/vendor-portal/VendorPOsList";
import VendorPODetail from "./pages/vendor-portal/VendorPODetail";
import VendorBillsList from "./pages/vendor-portal/VendorBillsList";
import VendorPortalBillDetail from "./pages/vendor-portal/VendorBillDetail";
import VendorNewBill from "./pages/vendor-portal/VendorNewBill";
import VendorSettings from "./pages/vendor-portal/VendorSettings";

// Subcontractor Portal
import { SubcontractorProtectedRoute } from "./components/subcontractor-portal/SubcontractorProtectedRoute";
import SubcontractorLogin from "./pages/subcontractor-portal/SubcontractorLogin";
import SubcontractorDashboard from "./pages/subcontractor-portal/SubcontractorDashboard";
import SubcontractorPOList from "./pages/subcontractor-portal/SubcontractorPOList";
import SubcontractorPODetail from "./pages/subcontractor-portal/SubcontractorPODetail";
import SubcontractorBillsList from "./pages/subcontractor-portal/SubcontractorBillsList";
import SubcontractorBillDetail from "./pages/subcontractor-portal/SubcontractorBillDetail";
import SubcontractorNewBill from "./pages/subcontractor-portal/SubcontractorNewBill";
import SubcontractorCompletions from "./pages/subcontractor-portal/SubcontractorCompletions";
import SubcontractorCompletionDetail from "./pages/subcontractor-portal/SubcontractorCompletionDetail";
import SubcontractorCompletionHistory from "./pages/subcontractor-portal/SubcontractorCompletionHistory";
import CompletionReviews from "./pages/CompletionReviews";

import NewChangeOrder from "./pages/NewChangeOrder";
import EditChangeOrder from "./pages/EditChangeOrder";
import ChangeOrderDetail from "./pages/ChangeOrderDetail";
import ApproveChangeOrder from "./pages/ApproveChangeOrder";
import ApproveChangeOrderPublic from "./pages/ApproveChangeOrderPublic";
import AuditLogs from "./pages/AuditLogs";
import StaffingApplications from "./pages/StaffingApplications";
import JobPostingEntries from "./pages/JobPostingEntries";
import PublicApplicationForm from "./pages/PublicApplicationForm";
import EditApplication from "./pages/EditApplication";
import ApplicationFormTemplates from "./pages/ApplicationFormTemplates";
import ApplicationFormBuilder from "./pages/ApplicationFormBuilder";
import PersonnelOnboarding from "./pages/PersonnelOnboarding";
import OnboardingComplete from "./pages/OnboardingComplete";
import AdminNotifications from "./pages/AdminNotifications";
import SessionHistory from "./pages/SessionHistory";
import ActivityHistory from "./pages/ActivityHistory";
import AiDevAssistant from "./pages/admin/AiDevAssistant";
import Trash from "./pages/admin/Trash";
import DocumentCenter from "./pages/DocumentCenter";
import { UpdateNotification } from "./components/electron/UpdateNotification";
import NetworkMapDemo from "./pages/NetworkMapDemo";
import USANetworkMapDemo from "./pages/USANetworkMapDemo";
import VendorOnboarding from "./pages/VendorOnboarding";
import VendorOnboardingComplete from "./pages/VendorOnboardingComplete";

const queryClient = new QueryClient();

// Wrapper component to use status bar hook inside ThemeProvider
const NativeStatusBarManager = () => {
  useNativeStatusBar();
  return null;
};

const App = () => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NativeStatusBarManager />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Router>
            <AuthProvider>
              <LocationTrackingProvider>
                <AIAssistantProvider>
                  <Routes>
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
                    {/* Onboarding Routes */}
                    <Route
                      path="/onboard/:token"
                      element={<PersonnelOnboarding />}
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
                      <Route path="/projects/:id" element={<ProjectDetail />} />
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
                  </Routes>
                  <BottomNav onMoreClick={() => setMoreMenuOpen(true)} />
                  <MoreMenu
                    open={moreMenuOpen}
                    onOpenChange={setMoreMenuOpen}
                  />
                  <ChatInterface />
                  <UpdateNotification />
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
