import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BottomNav } from "@/components/layout/BottomNav";
import { MoreMenu } from "@/components/layout/MoreMenu";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
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
import JobOrders from "./pages/JobOrders";
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
import TimeTracking from "./pages/TimeTracking";
import TeamTimesheet from "./pages/TeamTimesheet";
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
import RoofInspections from "./pages/RoofInspections";
import RoofInspectionDetail from "./pages/RoofInspectionDetail";
import RoofMeasurements from "./pages/RoofMeasurements";
import RoofMeasurementDetail from "./pages/RoofMeasurementDetail";
import Warranties from "./pages/Warranties";
import WarrantyDetail from "./pages/WarrantyDetail";
import WeatherTracking from "./pages/WeatherTracking";
import Activities from "./pages/Activities";
import Appointments from "./pages/Appointments";
import InsuranceClaims from "./pages/InsuranceClaims";
import Tasks from "./pages/Tasks";
import RoofingDashboard from "./pages/RoofingDashboard";
import QuickBooksSettings from "./pages/QuickBooksSettings";
import Messages from "./pages/Messages";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import EULA from "./pages/legal/EULA";
import NotFound from "./pages/NotFound";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalHours from "./pages/portal/PortalHours";
import PortalProjects from "./pages/portal/PortalProjects";
import PortalReimbursements from "./pages/portal/PortalReimbursements";
import PortalNotifications from "./pages/portal/PortalNotifications";
import PortalSettings from "./pages/portal/PortalSettings";
import PortalLogin from "./pages/portal/PortalLogin";
import AcceptPortalInvitation from "./pages/portal/AcceptPortalInvitation";
import { PortalProtectedRoute } from "./components/portal/PortalProtectedRoute";
import ContractorPortal from "./pages/contractor/ContractorPortal";
import ContractorSubmissionSuccess from "./pages/contractor/ContractorSubmissionSuccess";
import ContractorSubmissions from "./pages/admin/ContractorSubmissions";
import ContractorFormBuilder from "./pages/admin/ContractorFormBuilder";

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

import NewChangeOrder from "./pages/NewChangeOrder";
import EditChangeOrder from "./pages/EditChangeOrder";
import ChangeOrderDetail from "./pages/ChangeOrderDetail";
import ApproveChangeOrder from "./pages/ApproveChangeOrder";

const queryClient = new QueryClient();

const App = () => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
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
                  path="/personnel/register"
                  element={<PersonnelRegistrationPortal />}
                />
                <Route
                  path="/register/:token"
                  element={<PersonnelInviteRegister />}
                />
                <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                <Route path="/legal/eula" element={<EULA />} />
                {/* Public Contractor Routes */}
                <Route path="/contractor" element={<ContractorPortal />} />
                <Route path="/contractor/success" element={<ContractorSubmissionSuccess />} />
                {/* Admin Contractor Routes */}
                <Route path="/admin/contractor-submissions" element={<ProtectedRoute><ContractorSubmissions /></ProtectedRoute>} />
                <Route path="/admin/contractor-form-builder" element={<ProtectedRoute><ContractorFormBuilder /></ProtectedRoute>} />
                {/* Portal Routes */}
                <Route path="/portal/login" element={<PortalLogin />} />
                <Route path="/portal/accept-invite/:token" element={<AcceptPortalInvitation />} />
                <Route path="/portal" element={<PortalProtectedRoute><PortalDashboard /></PortalProtectedRoute>} />
                <Route path="/portal/hours" element={<PortalProtectedRoute><PortalHours /></PortalProtectedRoute>} />
                <Route path="/portal/projects" element={<PortalProtectedRoute><PortalProjects /></PortalProtectedRoute>} />
                <Route path="/portal/reimbursements" element={<PortalProtectedRoute><PortalReimbursements /></PortalProtectedRoute>} />
                <Route path="/portal/notifications" element={<PortalProtectedRoute><PortalNotifications /></PortalProtectedRoute>} />
                <Route path="/portal/settings" element={<PortalProtectedRoute><PortalSettings /></PortalProtectedRoute>} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <ProtectedRoute>
                      <Products />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customers"
                  element={
                    <ProtectedRoute>
                      <Customers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <Projects />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects/:id"
                  element={
                    <ProtectedRoute>
                      <ProjectDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vendors"
                  element={
                    <ProtectedRoute>
                      <Vendors />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vendors/:id"
                  element={
                    <ProtectedRoute>
                      <VendorDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vendor-bills"
                  element={
                    <ProtectedRoute>
                      <VendorBills />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vendor-bills/new"
                  element={
                    <ProtectedRoute>
                      <NewVendorBill />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vendor-bills/:id"
                  element={
                    <ProtectedRoute>
                      <VendorBillDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vendor-bills/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EditVendorBill />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vendor-documents"
                  element={
                    <ProtectedRoute>
                      <VendorDocuments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/jobs"
                  element={
                    <ProtectedRoute>
                      <Jobs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales"
                  element={
                    <ProtectedRoute>
                      <Sales />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/estimates"
                  element={
                    <ProtectedRoute>
                      <Estimates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/estimates/new"
                  element={
                    <ProtectedRoute>
                      <NewEstimate />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/estimates/:id"
                  element={
                    <ProtectedRoute>
                      <EstimateDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/estimates/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EditEstimate />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/job-orders"
                  element={
                    <ProtectedRoute>
                      <JobOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/job-orders/:id"
                  element={
                    <ProtectedRoute>
                      <JobOrderDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/job-orders/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EditJobOrder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchase-orders"
                  element={
                    <ProtectedRoute>
                      <PurchaseOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchase-orders/new"
                  element={
                    <ProtectedRoute>
                      <NewPurchaseOrder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchase-orders/:id"
                  element={
                    <ProtectedRoute>
                      <PurchaseOrderDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/change-orders/new"
                  element={
                    <ProtectedRoute>
                      <NewChangeOrder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/change-orders/:id"
                  element={
                    <ProtectedRoute>
                      <ChangeOrderDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/change-orders/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EditChangeOrder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/purchase-orders/:id/edit"
                  element={
                    <ProtectedRoute>
                      <EditPurchaseOrder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices"
                  element={
                    <ProtectedRoute>
                      <Invoices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/new"
                  element={
                    <ProtectedRoute>
                      <NewInvoice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/new-from-time"
                  element={
                    <ProtectedRoute>
                      <NewTimeEntryInvoice />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/:id"
                  element={
                    <ProtectedRoute>
                      <InvoiceDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/time-tracking"
                  element={
                    <ProtectedRoute>
                      <TimeTracking />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/team-timesheet"
                  element={
                    <ProtectedRoute>
                      <TeamTimesheet />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/project-assignments"
                  element={
                    <ProtectedRoute>
                      <ProjectAssignments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/personnel"
                  element={
                    <ProtectedRoute>
                      <Personnel />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/personnel/:id"
                  element={
                    <ProtectedRoute>
                      <PersonnelDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/badge-templates"
                  element={
                    <ProtectedRoute>
                      <BadgeTemplates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/badge-templates/:id"
                  element={
                    <ProtectedRoute>
                      <BadgeTemplateEditor />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/roof-inspections"
                  element={
                    <ProtectedRoute>
                      <RoofInspections />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/roof-inspections/:id"
                  element={
                    <ProtectedRoute>
                      <RoofInspectionDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/roof-measurements"
                  element={
                    <ProtectedRoute>
                      <RoofMeasurements />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/roof-measurements/:id"
                  element={
                    <ProtectedRoute>
                      <RoofMeasurementDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/warranties"
                  element={
                    <ProtectedRoute>
                      <Warranties />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/warranties/:id"
                  element={
                    <ProtectedRoute>
                      <WarrantyDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/weather-tracking"
                  element={
                    <ProtectedRoute>
                      <WeatherTracking />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/activities"
                  element={
                    <ProtectedRoute>
                      <Activities />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/appointments"
                  element={
                    <ProtectedRoute>
                      <Appointments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/insurance-claims"
                  element={
                    <ProtectedRoute>
                      <InsuranceClaims />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tasks"
                  element={
                    <ProtectedRoute>
                      <Tasks />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/roofing-dashboard"
                  element={
                    <ProtectedRoute>
                      <RoofingDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user-management"
                  element={
                    <ProtectedRoute>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/quickbooks"
                  element={
                    <ProtectedRoute>
                      <QuickBooksSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  }
                />
                {/* Vendor Portal Routes */}
                <Route path="/vendor/login" element={<VendorLogin />} />
                <Route path="/vendor/accept-invite/:token" element={<AcceptVendorInvitation />} />
                <Route path="/vendor" element={<VendorProtectedRoute><VendorDashboard /></VendorProtectedRoute>} />
                <Route path="/vendor/pos" element={<VendorProtectedRoute><VendorPOsList /></VendorProtectedRoute>} />
                <Route path="/vendor/pos/:id" element={<VendorProtectedRoute><VendorPODetail /></VendorProtectedRoute>} />
                <Route path="/vendor/bills" element={<VendorProtectedRoute><VendorBillsList /></VendorProtectedRoute>} />
                <Route path="/vendor/bills/new" element={<VendorProtectedRoute><VendorNewBill /></VendorProtectedRoute>} />
                <Route path="/vendor/bills/:id" element={<VendorProtectedRoute><VendorPortalBillDetail /></VendorProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <BottomNav onMoreClick={() => setMoreMenuOpen(true)} />
              <MoreMenu open={moreMenuOpen} onOpenChange={setMoreMenuOpen} />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
