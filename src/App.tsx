import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { toast } from "sonner";
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
import Roleplay from "./pages/Roleplay";
import CRM from "./pages/CRM";
import NotFound from "./pages/NotFound";
import LiveTradeNotifications from "./components/LiveTradeNotifications";

const queryClient = new QueryClient();

const App = () => {
  // Global error handler to prevent black screens from unhandled rejections
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
      toast.error("An error occurred. Please try again.");
      event.preventDefault(); // Prevent crash
    };

    const handleError = (event: ErrorEvent) => {
      console.error("Unhandled error:", event.error);
      // Don't show toast for all errors as it can be noisy
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LiveTradeNotifications />
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
              <Route path="/roleplay" element={<Roleplay />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
