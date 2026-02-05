 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { MessageSquare } from "lucide-react";
 
 export default function Messages() {
   return (
     <div className="container py-8">
       <h1 className="text-3xl font-bold mb-6">Messages</h1>
       
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <MessageSquare className="h-5 w-5" />
             No messages yet
           </CardTitle>
         </CardHeader>
         <CardContent>
           <p className="text-muted-foreground">
             Messages with hosts and guests will appear here once you start booking.
           </p>
         </CardContent>
       </Card>
     </div>
   );
 }