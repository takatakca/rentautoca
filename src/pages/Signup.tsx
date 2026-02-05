 import { useState } from "react";
 import { Link, useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 import { Car, Loader2, CheckCircle } from "lucide-react";
 
 export default function Signup() {
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [confirmPassword, setConfirmPassword] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(false);
   const [success, setSuccess] = useState(false);
   const navigate = useNavigate();
 
   const handleSignup = async (e: React.FormEvent) => {
     e.preventDefault();
     setError(null);
 
     if (password !== confirmPassword) {
       setError("Passwords do not match");
       return;
     }
 
     if (password.length < 6) {
       setError("Password must be at least 6 characters");
       return;
     }
 
     setLoading(true);
 
     const { error } = await supabase.auth.signUp({
       email,
       password,
       options: {
         emailRedirectTo: window.location.origin,
       },
     });
 
     if (error) {
       setError(error.message);
       setLoading(false);
     } else {
       setSuccess(true);
       setLoading(false);
     }
   };
 
   if (success) {
     return (
       <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
         <Card className="w-full max-w-md">
           <CardHeader className="text-center">
             <div className="flex justify-center mb-4">
               <CheckCircle className="h-12 w-12 text-primary" />
             </div>
             <CardTitle className="text-2xl">Check your email</CardTitle>
             <CardDescription>
               We've sent a confirmation link to <strong>{email}</strong>. 
               Click the link to verify your account.
             </CardDescription>
           </CardHeader>
           <CardFooter className="justify-center">
             <Button variant="outline" asChild>
               <Link to="/login">Back to login</Link>
             </Button>
           </CardFooter>
         </Card>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
       <Card className="w-full max-w-md">
         <CardHeader className="text-center">
           <div className="flex justify-center mb-4">
             <Car className="h-12 w-12 text-primary" />
           </div>
           <CardTitle className="text-2xl">Create an account</CardTitle>
           <CardDescription>Join Rentauto and start renting cars across Canada</CardDescription>
         </CardHeader>
         <form onSubmit={handleSignup}>
           <CardContent className="space-y-4">
             {error && (
               <Alert variant="destructive">
                 <AlertDescription>{error}</AlertDescription>
               </Alert>
             )}
             <div className="space-y-2">
               <Label htmlFor="email">Email</Label>
               <Input
                 id="email"
                 type="email"
                 placeholder="you@example.com"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="password">Password</Label>
               <Input
                 id="password"
                 type="password"
                 placeholder="••••••••"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 required
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="confirmPassword">Confirm Password</Label>
               <Input
                 id="confirmPassword"
                 type="password"
                 placeholder="••••••••"
                 value={confirmPassword}
                 onChange={(e) => setConfirmPassword(e.target.value)}
                 required
               />
             </div>
           </CardContent>
           <CardFooter className="flex flex-col gap-4">
             <Button type="submit" className="w-full" disabled={loading}>
               {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Sign up
             </Button>
             <p className="text-sm text-muted-foreground">
               Already have an account?{" "}
               <Link to="/login" className="text-primary hover:underline">
                 Log in
               </Link>
             </p>
           </CardFooter>
         </form>
       </Card>
     </div>
   );
 }