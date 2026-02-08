 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 import { Car, DollarSign, Shield, Loader2, CheckCircle } from "lucide-react";
 
 export default function BecomeHost() {
   const { user, hasRole, refreshRoles } = useAuth();
   const navigate = useNavigate();
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
 
   if (!user) {
     navigate("/login");
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
 
   const handleBecomeHost = async () => {
     setError(null);
     setLoading(true);
 
     const { error } = await supabase.from("user_roles").insert({
       user_id: user.id,
       role: "host" as const,
     });
 
     if (error) {
       setError(error.message);
       setLoading(false);
     } else {
       await refreshRoles();
       navigate("/host/onboarding");
     }
   };
 
   return (
     <div className="container py-8 max-w-4xl mx-auto">
       <div className="text-center mb-8">
         <h1 className="text-4xl font-bold mb-4">Become a Rentauto Host</h1>
         <p className="text-lg text-muted-foreground">
           Turn your car into a money-making machine. List your vehicle and earn when you're not using it.
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
               Average hosts earn $500+ per month. You set your own prices and availability.
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
               Every trip includes liability insurance and damage protection for your vehicle.
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
             Click below to become a host. You'll need to complete Stripe Connect onboarding 
             before you can publish listings.
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
           <Button size="lg" onClick={handleBecomeHost} disabled={loading}>
             {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
             Become a Host
           </Button>
         </CardFooter>
       </Card>
     </div>
   );
 }