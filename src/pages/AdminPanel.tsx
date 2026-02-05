 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Users, Car, Calendar, AlertTriangle } from "lucide-react";
 
 export default function AdminPanel() {
   return (
     <div className="container py-8">
       <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
 
       {/* Stats Cards */}
       <div className="grid sm:grid-cols-4 gap-6 mb-8">
         <Card>
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium">Total Users</CardTitle>
             <Users className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">0</div>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium">Listings</CardTitle>
             <Car className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">0</div>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium">Bookings</CardTitle>
             <Calendar className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">0</div>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between pb-2">
             <CardTitle className="text-sm font-medium">Disputes</CardTitle>
             <AlertTriangle className="h-4 w-4 text-muted-foreground" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">0</div>
           </CardContent>
         </Card>
       </div>
 
       {/* Admin Tabs */}
       <Tabs defaultValue="users">
         <TabsList>
           <TabsTrigger value="users">Users</TabsTrigger>
           <TabsTrigger value="listings">Listings</TabsTrigger>
           <TabsTrigger value="bookings">Bookings</TabsTrigger>
           <TabsTrigger value="payouts">Payouts</TabsTrigger>
         </TabsList>
         <TabsContent value="users">
           <Card>
             <CardHeader>
               <CardTitle>User Management</CardTitle>
               <CardDescription>View and manage all users, roles, and verification states.</CardDescription>
             </CardHeader>
             <CardContent>
               <p className="text-muted-foreground">User management will be implemented in Phase 6.</p>
             </CardContent>
           </Card>
         </TabsContent>
         <TabsContent value="listings">
           <Card>
             <CardHeader>
               <CardTitle>Listing Management</CardTitle>
               <CardDescription>Review and moderate vehicle listings.</CardDescription>
             </CardHeader>
             <CardContent>
               <p className="text-muted-foreground">Listing management will be implemented in Phase 6.</p>
             </CardContent>
           </Card>
         </TabsContent>
         <TabsContent value="bookings">
           <Card>
             <CardHeader>
               <CardTitle>Booking Overview</CardTitle>
               <CardDescription>Monitor all bookings across the platform.</CardDescription>
             </CardHeader>
             <CardContent>
               <p className="text-muted-foreground">Booking overview will be implemented in Phase 6.</p>
             </CardContent>
           </Card>
         </TabsContent>
         <TabsContent value="payouts">
           <Card>
             <CardHeader>
               <CardTitle>Payout Management</CardTitle>
               <CardDescription>Track host payouts and platform fees.</CardDescription>
             </CardHeader>
             <CardContent>
               <p className="text-muted-foreground">Payout management will be implemented in Phase 6.</p>
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>
     </div>
   );
 }