import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/AuthGuard";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import AIAssistant from "./pages/AIAssistant";
import CRM from "./pages/CRM";
import Research from "./pages/Research";
import Scraper from "./pages/Scraper";
import Outreach from "./pages/Outreach";
import Proposals from "./pages/Proposals";
import Analytics from "./pages/Analytics";
import Knowledge from "./pages/Knowledge";
import Competition from "./pages/Competition";
import Connectors from "./pages/Connectors";
import Admin from "./pages/Admin";
import Manager from "./pages/Manager";
import Owner from "./pages/Owner";
import Settings from "./pages/Settings";
import Onboarding from "./pages/Onboarding";
import Intelligence from "./pages/Intelligence";
import SalesStaff from "./pages/SalesStaff";
import SalesFlow from "./pages/SalesFlow";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/leads" element={<AuthGuard><Leads /></AuthGuard>} />
          <Route path="/ai-assistant" element={<AuthGuard><AIAssistant /></AuthGuard>} />
          <Route path="/crm" element={<AuthGuard><CRM /></AuthGuard>} />
          <Route path="/research" element={<AuthGuard><Research /></AuthGuard>} />
          <Route path="/scraper" element={<AuthGuard><Scraper /></AuthGuard>} />
          <Route path="/outreach" element={<AuthGuard><Outreach /></AuthGuard>} />
          <Route path="/proposals" element={<AuthGuard><Proposals /></AuthGuard>} />
          <Route path="/analytics" element={<AuthGuard><Analytics /></AuthGuard>} />
          <Route path="/knowledge" element={<AuthGuard><Knowledge /></AuthGuard>} />
          <Route path="/competition" element={<AuthGuard><Competition /></AuthGuard>} />
          <Route path="/connectors" element={<AuthGuard><Connectors /></AuthGuard>} />
          <Route path="/admin" element={<AuthGuard><Admin /></AuthGuard>} />
          <Route path="/manager" element={<AuthGuard><Manager /></AuthGuard>} />
          <Route path="/owner" element={<AuthGuard><Owner /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
          <Route path="/intelligence" element={<AuthGuard><Intelligence /></AuthGuard>} />
          <Route path="/sales-staff" element={<AuthGuard><SalesStaff /></AuthGuard>} />
          <Route path="/sales-flow" element={<AuthGuard><SalesFlow /></AuthGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
