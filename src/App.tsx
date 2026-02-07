import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";

// ... (existing code)

          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />

{/* Member Routes */ }
<Route path="/dashboard" element={<MemberLayout />}>
  <Route index element={<MemberDashboard />} />
  <Route path="payments" element={<MemberPayments />} />
  <Route path="visits" element={<MemberVisits />} />
  <Route path="profile" element={<MemberProfile />} />
  <Route path="scheme-selection" element={<MemberSchemeSelection />} />
  <Route path="dependants" element={<MemberDependants />} />
</Route>

{/* Receptionist Routes */ }
<Route path="/reception" element={<ReceptionLayout />}>
  <Route index element={<ReceptionDashboard />} />
  <Route path="register-visit" element={<RegisterVisit />} />
  <Route path="add-member" element={<ReceptionAddMember />} />
  <Route path="billing" element={<ReceptionBilling />} />
  <Route path="search" element={<ReceptionSearchMember />} />
</Route>

{/* Doctor Routes */ }
<Route path="/doctor" element={<DoctorLayout />}>
  <Route index element={<DoctorDashboard />} />
  <Route path="consultation/:visitId" element={<Consultation />} />
  <Route path="history" element={<DoctorPatientHistory />} />
</Route>

{/* Branch Director Routes */ }
<Route path="/director" element={<DirectorLayout />}>
  <Route index element={<DirectorDashboard />} />
  <Route path="revenue" element={<DirectorRevenue />} />
  <Route path="performance" element={<DirectorPerformance />} />
  <Route path="reports" element={<DirectorReports />} />
</Route>

{/* Marketer Routes */ }
<Route path="/marketer" element={<MarketerLayout />}>
  <Route index element={<MarketerDashboard />} />
  <Route path="referrals" element={<MarketerReferrals />} />
  <Route path="earnings" element={<MarketerEarnings />} />
  <Route path="links" element={<MarketerLinks />} />
</Route>

{/* Admin Routes */ }
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
            <Route path="settings" element={<AdminSettings />} />
            <Route path="membership-categories" element={<AdminMembershipCategories />} />
            <Route path="logs" element={<AdminLogs />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes >
      </BrowserRouter >
    </TooltipProvider >
  </QueryClientProvider >
);

export default App;