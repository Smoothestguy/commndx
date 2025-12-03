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
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import EULA from "./pages/legal/EULA";
import NotFound from "./pages/NotFound";

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
                  path="/personnel/register"
                  element={<PersonnelRegistrationPortal />}
                />
                <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                <Route path="/legal/eula" element={<EULA />} />
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
