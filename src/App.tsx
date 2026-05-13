import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const Explore = lazy(() => import("./pages/Explore"));
const Trips = lazy(() => import("./pages/Trips"));
const TripDetail = lazy(() => import("./pages/TripDetail"));
const Messages = lazy(() => import("./pages/Messages"));
const HostDashboard = lazy(() => import("./pages/HostDashboard"));
const HostOnboarding = lazy(() => import("./pages/HostOnboarding"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const BecomeHost = lazy(() => import("./pages/BecomeHost"));
const Profile = lazy(() => import("./pages/Profile"));
const CarListing = lazy(() => import("./pages/CarListing"));
const Favorites = lazy(() => import("./pages/Favorites"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/cars/:carId" element={<CarListing />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route
                  path="/trips"
                  element={
                    <ProtectedRoute>
                      <Trips />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trips/:tripId"
                  element={
                    <ProtectedRoute>
                      <TripDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/become-host"
                  element={
                    <ProtectedRoute>
                      <BecomeHost />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/host"
                  element={
                    <ProtectedRoute requiredRole="host">
                      <HostDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/host/onboarding"
                  element={
                    <ProtectedRoute requiredRole="host">
                      <HostOnboarding />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminPanel />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
