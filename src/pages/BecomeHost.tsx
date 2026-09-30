import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Car, DollarSign, Shield, Loader2, CheckCircle, Clock } from "lucide-react";

export default function BecomeHost() {
  const { user, hasRole, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [checkingApplication, setCheckingApplication] = useState(true);

  useEffect(() => {
    if (!user) {
      setCheckingApplication(false);
      return;
    }

    let active = true;
    void supabase
      .from("host_applications")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setApplicationStatus(data?.status ?? null);
        setCheckingApplication(false);
        if (data?.status === "approved") void refreshRoles();
      });

    return () => {
      active = false;
    };
  }, [user, refreshRoles]);

  if (!user) {
    navigate("/login?redirect=/become-host");
    return null;
  }

  if (hasRole("host")) {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-2xl">You're already a host!</CardTitle>
            <CardDescription>
              You can manage your listings from the Host Dashboard.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <a href="/host">Go to Host Dashboard</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const applied = applicationStatus === "pending" || applicationStatus === "approved";

  const handleApply = async () => {
    setError(null);
    setLoading(true);

    const { data, error: applicationError } = await supabase.functions.invoke(
      "rentauto-host-application",
      { body: {} },
    );

    setLoading(false);

    if (applicationError) {
      setError("We could not submit your host application. Please try again.");
      return;
    }

    const nextStatus =
      data &&
      typeof data === "object" &&
      "application" in data &&
      data.application &&
      typeof data.application === "object" &&
      "status" in data.application &&
      typeof data.application.status === "string"
        ? data.application.status
        : "pending";

    setApplicationStatus(nextStatus);
    setSubmitted(true);

    if (nextStatus === "approved") {
      await refreshRoles();
    }
  };

  if (checkingApplication) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted || applied) {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Clock className="h-16 w-16 text-primary" />
            </div>
            <CardTitle className="text-2xl">Application received</CardTitle>
            <CardDescription>
              Your host application is queued for review. Approval unlocks the host
              setup area; identity verification and payout setup are still required
              before a vehicle can be published.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>Back to home</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
 
   return (
     <div className="container py-8 max-w-4xl mx-auto">
       <div className="text-center mb-8">
         <h1 className="text-4xl font-bold mb-4">Become a Rentauto Host</h1>
         <p className="text-lg text-muted-foreground">
           Apply to list your vehicle, manage availability, and receive bookings through Rentauto.
         </p>
       </div>
 
       {/* Benefits */}
       <div className="grid md:grid-cols-3 gap-6 mb-8">
         <Card>
           <CardHeader>
             <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
               <DollarSign className="h-6 w-6 text-primary" />
             </div>
             <CardTitle className="text-lg">Earn extra income</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground text-sm">
               Set your own availability and pricing, then track confirmed rental earnings from your host dashboard.
             </p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader>
             <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
               <Shield className="h-6 w-6 text-primary" />
             </div>
             <CardTitle className="text-lg">Protected by insurance</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground text-sm">
               Protection details are shown on each confirmed booking so hosts and guests can review the applicable terms.
             </p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader>
             <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
               <Car className="h-6 w-6 text-primary" />
             </div>
             <CardTitle className="text-lg">You're in control</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground text-sm">
               Accept or decline booking requests. Set your own rules and meet guests on your terms.
             </p>
           </CardContent>
         </Card>
       </div>
 
       {/* CTA Card */}
       <Card className="max-w-md mx-auto">
         <CardHeader className="text-center">
           <CardTitle>Ready to start hosting?</CardTitle>
            <CardDescription>
              Submit your application to become a Rentauto host. Our team reviews
              every application before approval. Once approved, you'll complete
              Stripe Connect onboarding and can publish your first listing.
            </CardDescription>
         </CardHeader>
         <CardContent>
           {error && (
             <Alert variant="destructive" className="mb-4">
               <AlertDescription>{error}</AlertDescription>
             </Alert>
           )}
         </CardContent>
         <CardFooter className="justify-center">
            <Button size="lg" onClick={handleApply} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply to become a host
            </Button>
         </CardFooter>
       </Card>
     </div>
   );
 }