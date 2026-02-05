 import { Link } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { useAuth } from "@/contexts/AuthContext";
 import { Car, Shield, DollarSign, MapPin } from "lucide-react";
 
 export default function Home() {
   const { user, hasRole } = useAuth();
 
   return (
     <div className="flex flex-col">
       {/* Hero Section */}
       <section className="relative py-20 md:py-32 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/20">
         <div className="container mx-auto text-center">
           <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
             Rent cars from locals
             <br />
             <span className="text-primary">across Canada</span>
           </h1>
           <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
             The peer-to-peer car sharing marketplace. Skip the rental counter, 
             book unique cars from trusted hosts in your community.
           </p>
           <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <Button size="lg" asChild>
               <Link to="/explore">Browse cars</Link>
             </Button>
             {user && !hasRole("host") && (
               <Button size="lg" variant="outline" asChild>
                 <Link to="/become-host">Become a host</Link>
               </Button>
             )}
             {!user && (
               <Button size="lg" variant="outline" asChild>
                 <Link to="/signup">Get started</Link>
               </Button>
             )}
           </div>
         </div>
       </section>
 
       {/* Features Section */}
       <section className="py-16 md:py-24 px-4">
         <div className="container mx-auto">
           <h2 className="text-3xl font-bold text-center mb-12">Why Rentauto?</h2>
           <div className="grid md:grid-cols-3 gap-8">
             <div className="text-center p-6">
               <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Car className="h-8 w-8 text-primary" />
               </div>
               <h3 className="text-xl font-semibold mb-2">Unique selection</h3>
               <p className="text-muted-foreground">
                 From economy to luxury, find the perfect car from local hosts.
               </p>
             </div>
             <div className="text-center p-6">
               <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Shield className="h-8 w-8 text-primary" />
               </div>
               <h3 className="text-xl font-semibold mb-2">Protected trips</h3>
               <p className="text-muted-foreground">
                 Every trip includes insurance and 24/7 roadside assistance.
               </p>
             </div>
             <div className="text-center p-6">
               <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                 <DollarSign className="h-8 w-8 text-primary" />
               </div>
               <h3 className="text-xl font-semibold mb-2">Earn as a host</h3>
               <p className="text-muted-foreground">
                 List your car and earn money when you're not using it.
               </p>
             </div>
           </div>
         </div>
       </section>
 
       {/* CTA Section */}
       <section className="py-16 md:py-24 px-4 bg-muted/50">
         <div className="container mx-auto text-center">
           <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
             <MapPin className="h-5 w-5" />
             <span>Available across all Canadian provinces</span>
           </div>
           <h2 className="text-3xl font-bold mb-6">Ready to hit the road?</h2>
           <Button size="lg" asChild>
             <Link to="/explore">Find your ride</Link>
           </Button>
         </div>
       </section>
     </div>
   );
 }