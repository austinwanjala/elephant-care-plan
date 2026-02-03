import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

// Admin pages
import { AdminLayout } from "./components/admin/AdminLayout"; // Ensure AdminLayout is imported
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminBranches from "./pages/admin/AdminBranches";
import AdminStaff from "./pages/admin/AdminStaff";
// import AdminClaims from "./pages/admin/AdminClaims"; // Removed
import AdminServices from "./pages/admin/AdminServices";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminVisits from "./pages/admin/AdminVisits";
import AdminBranchPayments from "./pages/admin/AdminBranchPayments";
import AdminMembershipCategories from "./pages/admin/AdminMembershipCategories"; // New Admin page
import AdminMarketerClaims from "./pages/admin/AdminMarketerClaims"; // Marketer commission claims
import AdminCommissionSettings from "./pages/admin/AdminCommissionSettings"; // Marketer commission settings

// Reception pages
import { ReceptionLayout } from "./components/reception/ReceptionLayout";
import ReceptionDashboard from "./pages/reception/Dashboard";
import RegisterVisit from "./pages/reception/RegisterVisit";
import ReceptionBilling from "./pages/reception/Billing";
import ReceptionSearchMember from "./pages/reception/SearchMember"; // New Receptionist page

// Doctor pages
import { DoctorLayout } from "./components/doctor/DoctorLayout";
import DoctorDashboard from "./pages/doctor/Dashboard";
import Consultation from "./pages/doctor/Consultation";
import DoctorPatientHistory from "./pages/doctor/PatientHistory"; // New Doctor page

// Branch Director pages
import { DirectorLayout } from "./components/director/DirectorLayout";
import DirectorDashboard from "./pages/director/Dashboard";
import DirectorRevenue from "./pages/director/Revenue"; // New Director page
import DirectorPerformance from "./pages/director/Performance"; // New Director page
import DirectorReports from "./pages/director/Reports"; // New Director page

// Marketer pages
import { MarketerLayout } from "./components/marketer/MarketerLayout";
import MarketerDashboard from "./pages/marketer/Dashboard";
import MarketerReferrals from "./pages/marketer/Referrals"; // New Marketer page
import MarketerEarnings from "./pages/marketer/Earnings"; // New Marketer page
import MarketerLinks from "./pages/marketer/Links"; // New Marketer page

// Member pages
import { MemberLayout } from "./components/member/MemberLayout";
import MemberDashboard from "./pages/member/MemberDashboard"; // Renamed from Dashboard to MemberDashboard
import MemberPayments from "./pages/member/MemberPayments";
import MemberVisits from "./pages/member/MemberVisits";
import MemberProfile from "./pages/member/MemberProfile";
import MemberSchemeSelection from "./pages/member/MemberSchemeSelection"; // New Member page
import MemberDependants from "./pages/member/MemberDependants"; // New Member page

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

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
            <Route path="billing" element={<ReceptionBilling />} />
            <Route path="search" element={<ReceptionSearchMember />} />
          </Route>

          {/* Doctor Routes */}
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<DoctorDashboard />} />
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
            {/* <Route path="claims" element={<AdminClaims />} /> Removed as per new requirements */}
            <Route path="visits" element={<AdminVisits />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="branch-payments" element={<AdminBranchPayments />} />
            <Route path="marketer-claims" element={<AdminMarketerClaims />} />
            <Route path="commission-settings" element={<AdminCommissionSettings />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="membership-categories" element={<AdminMembershipCategories />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;