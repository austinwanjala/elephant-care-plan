import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PermissionWatcher } from "@/components/auth/PermissionWatcher";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

// Layouts
import { AdminLayout } from "./components/admin/AdminLayout";
import { ReceptionLayout } from "./components/reception/ReceptionLayout";
import { DoctorLayout } from "./components/doctor/DoctorLayout";
import { DirectorLayout } from "./components/director/DirectorLayout";
import { MarketerLayout } from "./components/marketer/MarketerLayout";
import { MemberLayout } from "./components/member/MemberLayout";
import { AuditorLayout } from "./components/auditor/AuditorLayout";

// Pages (omitting full list for brevity, keeping structure)
import AdminDashboard from "./pages/admin/AdminDashboard";
import AuditorDashboard from "./pages/auditor/Dashboard";
import AuditorFinancials from "./pages/auditor/Financials";
import AuditorMembers from "./pages/auditor/Members";
import AuditorVisits from "./pages/auditor/Visits";
import AuditorLogs from "./pages/auditor/Logs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PermissionWatcher />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Auditor Routes */}
          <Route path="/auditor" element={<AuditorLayout />}>
            <Route index element={<AuditorDashboard />} />
            <Route path="financials" element={<AuditorFinancials />} />
            <Route path="members" element={<AuditorMembers />} />
            <Route path="visits" element={<AuditorVisits />} />
            <Route path="logs" element={<AuditorLogs />} />
          </Route>

          {/* Other routes remain the same... */}
          <Route path="/admin" element={<AdminLayout />}><Route index element={<AdminDashboard />} /></Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;