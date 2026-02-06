import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useStripeConnect, OnboardingStatus } from "@/hooks/use-stripe-connect";
import {
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  RefreshCw,
} from "lucide-react";

function getStatusConfig(onboardingStatus: OnboardingStatus) {
  switch (onboardingStatus) {
    case "complete":
      return {
        icon: CheckCircle,
        iconColor: "text-success",
        badge: "Complete",
        badgeVariant: "default" as const,
        title: "Stripe Connected",
        description: "Your account is fully set up. You're ready to publish listings and receive payouts.",
      };
    case "pending":
      return {
        icon: AlertTriangle,
        iconColor: "text-warning",
        badge: "Action Required",
        badgeVariant: "secondary" as const,
        title: "Stripe Setup Incomplete",
        description:
          "Your Stripe account needs additional information before you can receive payouts. Click below to continue setup.",
      };
    case "error":
      return {
        icon: AlertTriangle,
        iconColor: "text-destructive",
        badge: "Error",
        badgeVariant: "destructive" as const,
        title: "Stripe Connection Error",
        description: "There was an issue retrieving your Stripe account status. Try refreshing.",
      };
    default:
      return {
        icon: CreditCard,
        iconColor: "text-muted-foreground",
        badge: "Not Started",
        badgeVariant: "outline" as const,
        title: "Set Up Stripe to Get Paid",
        description:
          "Connect your Stripe account to receive payouts from bookings. This is required before you can publish any vehicle listings.",
      };
  }
}

export function StripeStatusCard() {
  const { status, isLoading, isOnboarding, error, startOnboarding, refreshStatus, openDashboard } =
    useStripeConnect();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading Stripe status…</span>
        </CardContent>
      </Card>
    );
  }

  const onboardingStatus = status?.onboarding_status ?? "not_started";
  const config = getStatusConfig(onboardingStatus);
  const StatusIcon = config.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-6 w-6 ${config.iconColor}`} />
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <CardDescription className="mt-1">{config.description}</CardDescription>
            </div>
          </div>
          <Badge variant={config.badgeVariant}>{config.badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          {onboardingStatus === "not_started" && (
            <Button onClick={startOnboarding} disabled={isOnboarding}>
              {isOnboarding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Complete Stripe Setup
            </Button>
          )}

          {onboardingStatus === "pending" && (
            <Button onClick={startOnboarding} disabled={isOnboarding}>
              {isOnboarding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Continue Stripe Setup
            </Button>
          )}

          {onboardingStatus === "complete" && (
            <Button variant="outline" onClick={openDashboard}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Stripe Dashboard
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={refreshStatus} title="Refresh status">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {status?.charges_enabled !== undefined && onboardingStatus !== "not_started" && (
          <div className="flex gap-4 text-sm text-muted-foreground pt-2 border-t">
            <span>
              Charges:{" "}
              <span className={status.charges_enabled ? "text-success font-medium" : "text-destructive font-medium"}>
                {status.charges_enabled ? "Enabled" : "Disabled"}
              </span>
            </span>
            <span>
              Payouts:{" "}
              <span className={status.payouts_enabled ? "text-success font-medium" : "text-destructive font-medium"}>
                {status.payouts_enabled ? "Enabled" : "Disabled"}
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
