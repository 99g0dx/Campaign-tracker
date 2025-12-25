import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import CampaignDetail from "@/pages/CampaignDetail";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import VerifyAccount from "@/pages/VerifyAccount";
import Profile from "@/pages/Profile";
import SharedCampaign from "@/pages/SharedCampaign";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import InviteAccept from "@/pages/InviteAccept";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/invite" component={InviteAccept} />
        <Route path="/share/:slug" component={SharedCampaign} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route component={Landing} />
      </Switch>
    );
  }

  if (!user?.isVerified) {
    return (
      <Switch>
        <Route path="/verify" component={VerifyAccount} />
        <Route>{() => <Redirect to="/verify" />}</Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/campaign/:id" component={CampaignDetail} />
      <Route path="/profile" component={Profile} />
      <Route path="/invite" component={InviteAccept} />
      <Route path="/share/:slug" component={SharedCampaign} />
      <Route path="/login">{() => <Redirect to="/" />}</Route>
      <Route path="/signup">{() => <Redirect to="/" />}</Route>
      <Route path="/verify">{() => <Redirect to="/" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
