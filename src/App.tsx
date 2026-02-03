import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard"; // This will become the index for MemberLayout
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminBranches from "./pages/admin/AdminBranches";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminClaims from "./pages/admin/AdminClaims";
import AdminServices from "./pages/admin/AdminServices";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminVisits from "./pages/admin/AdminVisits";
import AdminBranchPayments from "./pages/admin/AdminBranchPayments"; // New import

// Reception pages
import { ReceptionLayout } from "./components/reception/ReceptionLayout";
import ReceptionDashboard from "./pages/reception/Dashboard";
import RegisterVisit from "./pages/reception/RegisterVisit";
import ReceptionBilling from "./pages/reception/Billing";

// Doctor pages
import { DoctorLayout } from "./components/doctor/DoctorLayout";
import DoctorDashboard from "./pages/doctor/Dashboard";
import Consultation from "./pages/doctor/Consultation";

// Branch Director pages
import { DirectorLayout } from "./components/director/DirectorLayout";
import DirectorDashboard from "./pages/director/Dashboard";

// Marketer pages
import { MarketerLayout } from "./components/marketer/MarketerLayout";
import MarketerDashboard from "./pages/marketer/Dashboard";

// Staff pages (Legacy - to be removed fully if any left, but removing imports now)
// import { StaffLayout } from "./components/staff/StaffLayout";
// import StaffDashboard from "./pages/staff/StaffDashboard";
// ... imports removed to fix errors

// Member pages
import { MemberLayout } from "./components/member/MemberLayout";
import MemberPayments from "./pages/member/MemberPayments";
import MemberVisits from "./pages/member/MemberVisits";
import MemberProfile from "./pages/member/MemberProfile";
import MemberClaimsList from "./pages/member/MemberClaimsList";
import MemberSubmitClaim from "./pages/member/MemberSubmitClaim";
import MemberPaymentSimulation from "./pages/member/MemberPaymentSimulation";

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
            <Route index element={<Dashboard />} />
            <Route path="claims" element={<MemberClaimsList />} />
            <Route path="claims/new" element={<MemberSubmitClaim />} />
            <Route path="payments" element={<MemberPayments />} />
            <Route path="visits" element={<MemberVisits />} />
            <Route path="profile" element={<MemberProfile />} />
            <Route path="pay" element={<MemberPaymentSimulation />} />
          </Route>

          {/* Receptionist Routes */}
          <Route path="/reception" element={<ReceptionLayout />}>
            <Route index element={<ReceptionDashboard />} />
            <Route path="register-visit" element={<RegisterVisit />} />
          </Route>


          {/* Doctor Routes */}
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<DoctorDashboard />} />
          </Route>


          {/* Branch Director Routes */}
          <Route path="/director" element={<DirectorLayout />}>
            <Route index element={<DirectorDashboard />} />
          </Route>


          {/* Marketer Routes */}
          <Route path="/marketer" element={<MarketerLayout />}>
            <Route index element={<MarketerDashboard />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/members" element={<AdminMembers />} />
          <Route path="/admin/branches" element={<AdminBranches />} />
          <Route path="/admin/staff" element={<AdminStaff />} />
          <Route path="/admin/claims" element={<AdminClaims />} />
          <Route path="/admin/visits" element={<AdminVisits />} />
          <Route path="/admin/services" element={<AdminServices />} />
          <Route path="/admin/branch-payments" element={<AdminBranchPayments />} />
          <Route path="/admin/settings" element={<AdminSettings />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;