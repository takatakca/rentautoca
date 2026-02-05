 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Calendar } from "lucide-react";
 
 export default function Trips() {
   return (
     <div className="container py-8">
       <h1 className="text-3xl font-bold mb-6">Your Trips</h1>
       
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Calendar className="h-5 w-5" />
             No trips yet
           </CardTitle>
         </CardHeader>
         <CardContent>
           <p className="text-muted-foreground">
             When you book a vehicle, your upcoming and past trips will appear here.
           </p>
         </CardContent>
       </Card>
     </div>
   );
 }