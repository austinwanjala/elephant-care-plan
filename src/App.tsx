import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Public Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Maintenance from "./pages/Maintenance";

// Layouts
import { MemberLayout } from "./components/member/MemberLayout";
import { ReceptionLayout } from "./components/reception/ReceptionLayout";
import { DoctorLayout } from "./components/doctor/DoctorLayout";
import { DirectorLayout } from "./components/director/DirectorLayout";
import { MarketerLayout } from "./components/marketer/MarketerLayout";
import { AdminLayout } from "./components/admin/AdminLayout";
import { SuperAdminLayout } from "./components/super-admin/SuperAdminLayout";
import { FinanceLayout } from "./components/finance/FinanceLayout";
import { AuditorLayout } from "./components/auditor/AuditorLayout";

// Member Pages
import MemberDashboard from "./pages/member/MemberDashboard";
import MemberPayments from "./pages/member/MemberPayments";
import MemberVisits from "./pages/member/MemberVisits";
import MemberProfile from "./pages/member/MemberProfile";
import MemberSchemeSelection from "./pages/member/MemberSchemeSelection";
import MemberDependants from "./pages/member/MemberDependants";

// Reception Pages
import ReceptionDashboard from "./pages/reception/Dashboard";
import RegisterVisit from "./pages/reception/RegisterVisit";
import ReceptionAddMember from "./pages/reception/AddMember";
import ReceptionBilling from "./pages/reception/Billing";
import ReceptionSearchMember from "./pages/reception/SearchMember";

// Doctor Pages
import DoctorDashboard from "./pages/doctor/Dashboard";
import DoctorQueue from "./pages/doctor/Queue";
import Consultation from "./pages/doctor/Consultation";
import DoctorPatientHistory from "./pages/doctor/PatientHistory";

// Director Pages
import DirectorDashboard from "./pages/director/Dashboard";
import DirectorRevenue from "./pages/director/Revenue";
import DirectorPerformance from "./pages/director/Performance";
import DirectorReports from "./pages/director/Reports";

// Marketer Pages
import MarketerDashboard from "./pages/marketer/Dashboard";
import MarketerReferrals from "./pages/marketer/Referrals";
import MarketerEarnings from "./pages/marketer/Earnings";
import MarketerLinks from "./pages/marketer/Links";
import MarketerAddMember from "./pages/marketer/AddMember";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminBranches from "./pages/admin/AdminBranches";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminVisits from "./pages/admin/AdminVisits";
import AdminServices from "./pages/admin/AdminServices";
import AdminBranchPayments from "./pages/admin/AdminBranchPayments";
import AdminMarketerClaims from "./pages/admin/AdminMarketerClaims";
import AdminCommissionSettings from "./pages/admin/AdminCommissionSettings";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminMembershipCategories from "./pages/admin/AdminMembershipCategories";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminPermissions from "./pages/admin/AdminPermissions";

// Finance Pages
import FinanceDashboard from "./pages/finance/Dashboard";

// Auditor Pages
import AuditorDashboard from "./pages/auditor/Dashboard";
import AuditorMembers from "./pages/auditor/Members";
import AuditorVisits from "./pages/auditor/Visits";
import AuditorFinancials from "./pages/auditor/Financials";
import AuditorLogs from "./pages/auditor/Logs";

import { SchemeChat } from "@/components/SchemeChat";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SchemeChat />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/maintenance" element={<Maintenance />} />

          {/* Member Routes */}
          <Route path="/dashboard" element={<MemberLayout />}>
            <Route index element={<MemberDashboard />} />
            <Route path="payments" element={<MemberPayments />} />
            <Route path="visits" element={<MemberVisits />} />
            <Route path="profile" element={<MemberProfile />} />
            <Route path="scheme-selection" element={<MemberSchemeSelection />} />
            <Route path="dependants" element={<MemberDependants />} />
          </Route>

          {/* Receptionist Routes */}
          <Route path="/reception" element={<ReceptionLayout />}>
            <Route index element={<ReceptionDashboard />} />
            <Route path="register-visit" element={<RegisterVisit />} />
            <Route path="add-member" element={<ReceptionAddMember />} />
            <Route path="billing" element={<ReceptionBilling />} />
            <Route path="search" element={<ReceptionSearchMember />} />
          </Route>

          {/* Doctor Routes */}
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<DoctorDashboard />} />
            <Route path="queue" element={<DoctorQueue />} />
            <Route path="consultation/:visitId" element={<Consultation />} />
            <Route path="history" element={<DoctorPatientHistory />} />
          </Route>

          {/* Branch Director Routes */}
          <Route path="/director" element={<DirectorLayout />}>
            <Route index element={<DirectorDashboard />} />
            <Route path="revenue" element={<DirectorRevenue />} />
            <Route path="performance" element={<DirectorPerformance />} />
            <Route path="reports" element={<DirectorReports />} />
          </Route>

          {/* Marketer Routes */}
          <Route path="/marketer" element={<MarketerLayout />}>
            <Route index element={<MarketerDashboard />} />
            <Route path="add-member" element={<MarketerAddMember />} />
            <Route path="referrals" element={<MarketerReferrals />} />
            <Route path="earnings" element={<MarketerEarnings />} />
            <Route path="links" element={<MarketerLinks />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="branches" element={<AdminBranches />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="visits" element={<AdminVisits />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="branch-payments" element={<AdminBranchPayments />} />
            <Route path="marketer-claims" element={<AdminMarketerClaims />} />
            <Route path="commission-settings" element={<AdminCommissionSettings />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="membership-categories" element={<AdminMembershipCategories />} />
            <Route path="logs" element={<AdminLogs />} />
          </Route>

          {/* Super Admin Routes */}
          <Route path="/super-admin" element={<SuperAdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="branches" element={<AdminBranches />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="visits" element={<AdminVisits />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="branch-payments" element={<AdminBranchPayments />} />
            <Route path="marketer-claims" element={<AdminMarketerClaims />} />
            <Route path="commission-settings" element={<AdminCommissionSettings />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="membership-categories" element={<AdminMembershipCategories />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="permissions" element={<AdminPermissions />} />
          </Route>

          {/* Finance Routes */}
          <Route path="/finance" element={<FinanceLayout />}>
            <Route index element={<FinanceDashboard />} />
            <Route path="marketer-payments" element={<AdminMarketerClaims />} />
            <Route path="branch-payments" element={<AdminBranchPayments />} />
            <Route path="history" element={<AdminBranchPayments />} />
          </Route>

          {/* Auditor Routes */}
          <Route path="/auditor" element={<AuditorLayout />}>
            <Route index element={<AuditorDashboard />} />
            <Route path="members" element={<AuditorMembers />} />
            <Route path="visits" element={<AuditorVisits />} />
            <Route path="financials" element={<AuditorFinancials />} />
            <Route path="logs" element={<AuditorLogs />} />
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;