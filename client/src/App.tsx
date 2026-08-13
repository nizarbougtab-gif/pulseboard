import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { lazy, Suspense } from "react";
import PwaStatus from "./components/PwaStatus";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ServiceView = lazy(() => import("./pages/ServiceView"));
const PatientView = lazy(() => import("./pages/PatientView"));
const Timeline = lazy(() => import("./pages/Timeline"));
const Profile = lazy(() => import("./pages/Profile"));
const MonStage = lazy(() => import("./pages/MonStage"));
const PersonalPatientView = lazy(() => import("./pages/PersonalPatientView"));
const Subscription = lazy(() => import("./pages/Subscription"));
const ForgotPassword = lazy(() => import("./pages/AccountAccess").then(module => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import("./pages/AccountAccess").then(module => ({ default: module.ResetPassword })));
const VerifyEmail = lazy(() => import("./pages/AccountAccess").then(module => ({ default: module.VerifyEmail })));
const Privacy = lazy(() => import("./pages/Legal").then(module => ({ default: module.Privacy })));
const Terms = lazy(() => import("./pages/Legal").then(module => ({ default: module.Terms })));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/service/:id" component={ServiceView} />
        <Route path="/patient/:id" component={PatientView} />
        <Route path="/timeline/:serviceId" component={Timeline} />
        <Route path="/profile" component={Profile} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/mon-stage" component={MonStage} />
        <Route path="/mon-stage/patient/:id" component={PersonalPatientView} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <PwaStatus />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
