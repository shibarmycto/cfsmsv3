import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import About from "./pages/About";
import FAQs from "./pages/FAQs";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import BuyCrypto from "./pages/BuyCrypto";
import Bank from "./pages/Bank";
import CFMiner from "./pages/CFMiner";
import AITwin from "./pages/AITwin";
import Forum from "./pages/Forum";
import Promo from "./pages/Promo";
import Exchange from "./pages/Exchange";
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
            <Route path="/about" element={<About />} />
            <Route path="/faqs" element={<FAQs />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/buy-crypto" element={<BuyCrypto />} />
            <Route path="/bank" element={<Bank />} />
            <Route path="/miner" element={<CFMiner />} />
            <Route path="/ai-twin" element={<AITwin />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/promo" element={<Promo />} />
            <Route path="/exchange" element={<Exchange />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
