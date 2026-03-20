import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import AIAssistant from "./pages/AIAssistant";
import CRM from "./pages/CRM";
import Research from "./pages/Research";
import Outreach from "./pages/Outreach";
import Proposals from "./pages/Proposals";
import Analytics from "./pages/Analytics";
import Knowledge from "./pages/Knowledge";
import Competition from "./pages/Competition";
import Connectors from "./pages/Connectors";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/research" element={<Research />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/competition" element={<Competition />} />
          <Route path="/connectors" element={<Connectors />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
