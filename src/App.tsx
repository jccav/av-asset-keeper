import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

import Index from "./pages/Index";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminInventory from "./pages/AdminInventory";
import AdminHistory from "./pages/AdminHistory";
import AdminAdmins from "./pages/AdminAdmins";
import AdminLayout from "./components/AdminLayout";
import Setup from "./pages/Setup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        {/* ✅ IMPORTANT FIX FOR GITHUB PAGES */}
        <BrowserRouter basename="/av-asset-keeper">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <AdminLayout>
                  <AdminInventory />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/history"
              element={
                <AdminLayout>
                  <AdminHistory />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/admins"
              element={
                <AdminLayout>
                  <AdminAdmins />
                </AdminLayout>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>

      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
