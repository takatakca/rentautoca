 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Car, Calendar, DollarSign, Plus } from "lucide-react";
 
 export default function HostDashboard() {
   return (
     <div className="container py-8">
       <div className="flex items-center justify-between mb-6">
         <h1 className="text-3xl font-bold">Host Dashboard</h1>
         <Button>
           <Plus className="h-4 w-4 mr-2" />
           Add Vehicle
         </Button>
       </div>
 
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
             Vehicle management will be available in Phase 3. 
             Stripe Connect onboarding is required before publishing listings.
           </p>
           {/* TODO: Phase 2 - Stripe Connect onboarding */}
         </CardContent>
       </Card>
     </div>
   );
 }