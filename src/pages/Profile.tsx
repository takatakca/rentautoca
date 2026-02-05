 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 import { Loader2, Save } from "lucide-react";
 import { useToast } from "@/hooks/use-toast";
 
 interface Province {
   code: string;
   name: string;
 }
 
 interface ProfileData {
   first_name: string | null;
   last_name: string | null;
   phone: string | null;
   city: string | null;
   province: string | null;
   postal_code: string | null;
 }
 
 export default function Profile() {
   const { user, roles } = useAuth();
   const { toast } = useToast();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [provinces, setProvinces] = useState<Province[]>([]);
   const [profile, setProfile] = useState<ProfileData>({
     first_name: "",
     last_name: "",
     phone: "",
     city: "",
     province: "",
     postal_code: "",
   });
 
   useEffect(() => {
     const fetchData = async () => {
       // Fetch provinces
       const { data: provincesData } = await supabase
         .from("provinces")
         .select("code, name")
         .eq("is_supported", true)
         .order("sort_order");
       
       if (provincesData) {
         setProvinces(provincesData);
       }
 
       // Fetch profile
       if (user) {
         const { data: profileData } = await supabase
           .from("profiles")
           .select("first_name, last_name, phone, city, province, postal_code")
           .eq("id", user.id)
           .single();
         
         if (profileData) {
           setProfile({
             first_name: profileData.first_name || "",
             last_name: profileData.last_name || "",
             phone: profileData.phone || "",
             city: profileData.city || "",
             province: profileData.province || "",
             postal_code: profileData.postal_code || "",
           });
         }
       }
       setLoading(false);
     };
 
     fetchData();
   }, [user]);
 
   const handleSave = async () => {
     if (!user) return;
     
     setSaving(true);
     const { error } = await supabase
       .from("profiles")
       .update({
         first_name: profile.first_name || null,
         last_name: profile.last_name || null,
         phone: profile.phone || null,
         city: profile.city || null,
         province: profile.province || null,
         postal_code: profile.postal_code || null,
       })
       .eq("id", user.id);
 
     setSaving(false);
 
     if (error) {
       toast({
         title: "Error",
         description: error.message,
         variant: "destructive",
       });
     } else {
       toast({
         title: "Profile updated",
         description: "Your profile has been saved successfully.",
       });
     }
   };
 
   if (loading) {
     return (
       <div className="flex min-h-[50vh] items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <div className="container py-8 max-w-2xl mx-auto">
       <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
 
       <Card className="mb-6">
         <CardHeader>
           <CardTitle>Account Information</CardTitle>
           <CardDescription>Your email and roles</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div>
             <Label>Email</Label>
             <p className="text-sm text-muted-foreground">{user?.email}</p>
           </div>
           <div>
             <Label>Roles</Label>
             <div className="flex gap-2 mt-1">
               {roles.map((role) => (
                 <span
                   key={role}
                   className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize"
                 >
                   {role}
                 </span>
               ))}
             </div>
           </div>
         </CardContent>
       </Card>
 
       <Card>
         <CardHeader>
           <CardTitle>Personal Information</CardTitle>
           <CardDescription>Update your personal details</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="grid sm:grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label htmlFor="firstName">First Name</Label>
               <Input
                 id="firstName"
                 value={profile.first_name || ""}
                 onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="lastName">Last Name</Label>
               <Input
                 id="lastName"
                 value={profile.last_name || ""}
                 onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
               />
             </div>
           </div>
           <div className="space-y-2">
             <Label htmlFor="phone">Phone</Label>
             <Input
               id="phone"
               type="tel"
               value={profile.phone || ""}
               onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
             />
           </div>
           <div className="grid sm:grid-cols-3 gap-4">
             <div className="space-y-2">
               <Label htmlFor="city">City</Label>
               <Input
                 id="city"
                 value={profile.city || ""}
                 onChange={(e) => setProfile({ ...profile, city: e.target.value })}
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="province">Province</Label>
               <Select
                 value={profile.province || ""}
                 onValueChange={(value) => setProfile({ ...profile, province: value })}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select province" />
                 </SelectTrigger>
                 <SelectContent>
                   {provinces.map((prov) => (
                     <SelectItem key={prov.code} value={prov.code}>
                       {prov.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label htmlFor="postalCode">Postal Code</Label>
               <Input
                 id="postalCode"
                 value={profile.postal_code || ""}
                 onChange={(e) => setProfile({ ...profile, postal_code: e.target.value.toUpperCase() })}
               />
             </div>
           </div>
         </CardContent>
         <CardFooter>
           <Button onClick={handleSave} disabled={saving}>
             {saving ? (
               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             ) : (
               <Save className="mr-2 h-4 w-4" />
             )}
             Save Changes
           </Button>
         </CardFooter>
       </Card>
     </div>
   );
 }