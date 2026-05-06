import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Pricing from "./pages/Pricing.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Research from "./pages/Research.tsx";
import Matters from "./pages/Matters.tsx";
import MatterDetail from "./pages/MatterDetail.tsx";
import Drafts from "./pages/Drafts.tsx";
import DraftEditor from "./pages/DraftEditor.tsx";
import Settings from "./pages/Settings.tsx";
import Legal from "./pages/Legal.tsx";
import AdminOverview from "./pages/admin/AdminOverview.tsx";
import AdminCustomers from "./pages/admin/AdminCustomers.tsx";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions.tsx";
import AdminPayments from "./pages/admin/AdminPayments.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/legal/:slug" element={<Legal />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/app/research" element={<ProtectedRoute><Research /></ProtectedRoute>} />
            <Route path="/app/matters" element={<ProtectedRoute><Matters /></ProtectedRoute>} />
            <Route path="/app/matters/:id" element={<ProtectedRoute><MatterDetail /></ProtectedRoute>} />
            <Route path="/app/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
            <Route path="/app/drafts/:id" element={<ProtectedRoute><DraftEditor /></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
