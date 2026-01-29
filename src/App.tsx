import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminBranches from "./pages/admin/AdminBranches";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminClaims from "./pages/admin/AdminClaims";
import AdminServices from "./pages/admin/AdminServices";
import AdminSettings from "./pages/admin/AdminSettings";

// Staff pages
import { StaffLayout } from "./components/staff/StaffLayout";
import StaffDashboard from "./pages/staff/StaffDashboard";
import TodaysList from "./pages/staff/TodaysList";
import BranchRevenue from "./pages/staff/BranchRevenue";
import MemberRegistration from "./pages/staff/MemberRegistration";
import BranchServices from "./pages/staff/BranchServices";


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
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Staff Routes */}
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<StaffDashboard />} />
            <Route path="today" element={<TodaysList />} />
            <Route path="revenue" element={<BranchRevenue />} />
            <Route path="register-member" element={<MemberRegistration />} />
            <Route path="services" element={<BranchServices />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/members" element={<AdminMembers />} />
          <Route path="/admin/branches" element={<AdminBranches />} />
          <Route path="/admin/staff" element={<AdminStaff />} />
          <Route path="/admin/claims" element={<AdminClaims />} />
          <Route path="/admin/services" element={<AdminServices />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;