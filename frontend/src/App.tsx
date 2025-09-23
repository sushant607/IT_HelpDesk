import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardPage from "./components/dashboard/DashboardPage";
import MyTicketsPage from "./components/tickets/MyTicketsPage";
import AllTicketsPage from "./components/tickets/AllTicketsPage";
import NewTicketPage from "./components/tickets/NewTicketPage";
import TicketDetailsPage from "./components/tickets/TicketDetailsPage";
import ChatbotPage from "./components/tickets/ChatbotPage";
import NotificationsPage from "./components/notifications/NotificationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("auth_token");
  return token ? <>{children}</> : <Navigate to="/login" />;
};

// Role-based Route Component
const RoleBasedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const userRole = localStorage.getItem("user_role");
  return allowedRoles.includes(userRole || "") ? <>{children}</> : <Navigate to="/dashboard" />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          
          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          {/* Protected dashboard routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="tickets" element={<MyTicketsPage />} />
            <Route path="tickets/new" element={<NewTicketPage />} />
            <Route path="tickets/:ticketId" element={<TicketDetailsPage />} />
            <Route path="all-tickets" element={
              <RoleBasedRoute allowedRoles={["manager"]}>
                <AllTicketsPage />
              </RoleBasedRoute>
            } />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="chatbot" element={<ChatbotPage />} />
          </Route>
          
          {/* Catch-all route aliases */}
          <Route path="/tickets" element={<Navigate to="/dashboard/tickets" />} />
          <Route path="/tickets/new" element={<Navigate to="/dashboard/tickets/new" />} />
          <Route path="/all-tickets" element={<Navigate to="/dashboard/all-tickets" />} />
          <Route path="/chatbot" element={<Navigate to="/dashboard/chatbot" />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
