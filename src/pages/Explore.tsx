 import { Card, CardContent } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Search, MapPin, Calendar } from "lucide-react";
 
 export default function Explore() {
   // Placeholder vehicle data
   const placeholderCars = Array.from({ length: 6 }, (_, i) => ({
     id: i + 1,
     name: `Vehicle ${i + 1}`,
     location: "Toronto, ON",
     price: 75 + i * 10,
   }));
 
   return (
     <div className="container py-8">
       {/* Search Section */}
       <div className="mb-8 p-6 bg-muted/50 rounded-lg">
         <h1 className="text-2xl font-bold mb-4">Find your perfect ride</h1>
         <div className="flex flex-col md:flex-row gap-4">
           <div className="flex-1 relative">
             <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input placeholder="City, airport, or address" className="pl-10" />
           </div>
           <div className="flex-1 relative">
             <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input placeholder="Pick-up date" className="pl-10" />
           </div>
           <div className="flex-1 relative">
             <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input placeholder="Return date" className="pl-10" />
           </div>
           <Button>
             <Search className="h-4 w-4 mr-2" />
             Search
           </Button>
         </div>
       </div>
 
       {/* Results Grid */}
       <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
         {placeholderCars.map((car) => (
           <Card key={car.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
             <div className="aspect-video bg-muted flex items-center justify-center">
               <span className="text-muted-foreground">Vehicle Image</span>
             </div>
             <CardContent className="p-4">
               <h3 className="font-semibold text-lg">{car.name}</h3>
               <p className="text-sm text-muted-foreground flex items-center gap-1">
                 <MapPin className="h-3 w-3" />
                 {car.location}
               </p>
               <p className="mt-2 font-bold text-primary">
                 ${car.price} <span className="text-sm font-normal text-muted-foreground">CAD/day</span>
               </p>
             </CardContent>
           </Card>
         ))}
       </div>
 
       <p className="text-center text-muted-foreground mt-8">
         Vehicle listings coming soon. This is a placeholder view.
       </p>
     </div>
   );
 }