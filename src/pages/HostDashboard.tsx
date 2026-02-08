import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Car, Calendar, DollarSign, Plus, ArrowRight } from "lucide-react";
import { StripeStatusCard } from "@/components/host/StripeStatusCard";
import { useHostCompletion } from "@/hooks/use-host-completion";

export default function HostDashboard() {
  const completion = useHostCompletion();

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Host Dashboard</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Completion Banner */}
      {!completion.isLoading && completion.percentage < 100 && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4 gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm mb-2">
                Profile {completion.percentage}% complete
              </p>
              <Progress value={completion.percentage} className="h-2" />
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to="/host/onboarding">
                Continue Setup
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00 CAD</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Vehicles listed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Reservations</p>
          </CardContent>
        </Card>
      </div>

      {/* Stripe Connect Status */}
      <div className="mb-8">
        <StripeStatusCard />
      </div>

      {/* Placeholder Content */}
      <Card>
        <CardHeader>
          <CardTitle>Your Vehicles</CardTitle>
          <CardDescription>
            You haven't listed any vehicles yet. Add your first car to start earning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Vehicle management coming soon. Complete your host profile setup first.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
