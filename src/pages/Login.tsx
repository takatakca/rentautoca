 import { useState } from "react";
 import { Link, useNavigate, useLocation } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 import { Car, Loader2 } from "lucide-react";
 
 export default function Login() {
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [error, setError] = useState<string | null>(null);
   const [loading, setLoading] = useState(false);
   const navigate = useNavigate();
   const location = useLocation();
   
   const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
 
   const handleLogin = async (e: React.FormEvent) => {
     e.preventDefault();
     setError(null);
     setLoading(true);
 
     const { error } = await supabase.auth.signInWithPassword({
       email,
       password,
     });
 
     if (error) {
       setError(error.message);
       setLoading(false);
     } else {
       navigate(from, { replace: true });
     }
   };
 
   return (
     <div className="min-h-screen flex items-center justify-center px-4 py-12">
       <Card className="w-full max-w-md">
         <CardHeader className="text-center">
           <div className="flex justify-center mb-4">
             <Car className="h-12 w-12 text-primary" />
           </div>
           <CardTitle className="text-2xl">Welcome back</CardTitle>
           <CardDescription>Sign in to your Rentauto account</CardDescription>
         </CardHeader>
         <form onSubmit={handleLogin}>
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
           </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot your password?
              </Link>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
         </form>
       </Card>
     </div>
   );
 }