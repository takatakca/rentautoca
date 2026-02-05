 import { Link, useNavigate } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { useAuth } from "@/contexts/AuthContext";
 import { RoleGate } from "@/components/auth/RoleGate";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
 import { Avatar, AvatarFallback } from "@/components/ui/avatar";
 import { Car, Menu, User, LogOut, LayoutDashboard, Shield } from "lucide-react";
 import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
 import { useState } from "react";
 
 export function AppHeader() {
   const { user, signOut, hasRole } = useAuth();
   const navigate = useNavigate();
   const [mobileOpen, setMobileOpen] = useState(false);
 
   const handleSignOut = async () => {
     await signOut();
     navigate("/");
   };
 
   const navLinks = [
     { to: "/explore", label: "Explore" },
   ];
 
   const userLinks = [
     { to: "/trips", label: "Trips" },
     { to: "/messages", label: "Messages" },
   ];
 
   return (
     <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
       <div className="container flex h-16 items-center justify-between">
         <div className="flex items-center gap-6">
           <Link to="/" className="flex items-center gap-2">
             <Car className="h-8 w-8 text-primary" />
             <span className="text-xl font-bold text-foreground">Rentauto</span>
           </Link>
           
           <nav className="hidden md:flex items-center gap-4">
             {navLinks.map((link) => (
               <Link
                 key={link.to}
                 to={link.to}
                 className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
               >
                 {link.label}
               </Link>
             ))}
           </nav>
         </div>
 
         <div className="flex items-center gap-4">
           {user ? (
             <>
               <nav className="hidden md:flex items-center gap-4">
                 {userLinks.map((link) => (
                   <Link
                     key={link.to}
                     to={link.to}
                     className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                   >
                     {link.label}
                   </Link>
                 ))}
                 <RoleGate allowedRoles={["host", "admin"]}>
                   <Link
                     to="/host"
                     className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                   >
                     Host Dashboard
                   </Link>
                 </RoleGate>
                 <RoleGate allowedRoles={["admin"]}>
                   <Link
                     to="/admin"
                     className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                   >
                     Admin
                   </Link>
                 </RoleGate>
               </nav>
 
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                     <Avatar className="h-10 w-10">
                       <AvatarFallback className="bg-primary text-primary-foreground">
                         {user.email?.charAt(0).toUpperCase() || "U"}
                       </AvatarFallback>
                     </Avatar>
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="w-56">
                   <div className="flex items-center gap-2 p-2">
                     <div className="flex flex-col space-y-0.5">
                       <p className="text-sm font-medium">{user.email}</p>
                       <p className="text-xs text-muted-foreground">
                         {hasRole("admin") ? "Admin" : hasRole("host") ? "Host" : "Guest"}
                       </p>
                     </div>
                   </div>
                   <DropdownMenuSeparator />
                   <DropdownMenuItem asChild>
                     <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                       <User className="h-4 w-4" />
                       Profile
                     </Link>
                   </DropdownMenuItem>
                   <RoleGate allowedRoles={["host", "admin"]}>
                     <DropdownMenuItem asChild>
                       <Link to="/host" className="flex items-center gap-2 cursor-pointer">
                         <LayoutDashboard className="h-4 w-4" />
                         Host Dashboard
                       </Link>
                     </DropdownMenuItem>
                   </RoleGate>
                   <RoleGate allowedRoles={["admin"]}>
                     <DropdownMenuItem asChild>
                       <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                         <Shield className="h-4 w-4" />
                         Admin Panel
                       </Link>
                     </DropdownMenuItem>
                   </RoleGate>
                   <DropdownMenuSeparator />
                   <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                     <LogOut className="h-4 w-4 mr-2" />
                     Sign out
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
             </>
           ) : (
             <div className="hidden md:flex items-center gap-2">
               <Button variant="ghost" asChild>
                 <Link to="/login">Log in</Link>
               </Button>
               <Button asChild>
                 <Link to="/signup">Sign up</Link>
               </Button>
             </div>
           )}
 
           {/* Mobile menu */}
           <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
             <SheetTrigger asChild className="md:hidden">
               <Button variant="ghost" size="icon">
                 <Menu className="h-5 w-5" />
               </Button>
             </SheetTrigger>
             <SheetContent side="right" className="w-72">
               <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
               <nav className="flex flex-col gap-4 mt-8">
                 {navLinks.map((link) => (
                   <Link
                     key={link.to}
                     to={link.to}
                     onClick={() => setMobileOpen(false)}
                     className="text-lg font-medium hover:text-primary transition-colors"
                   >
                     {link.label}
                   </Link>
                 ))}
                 {user && (
                   <>
                     {userLinks.map((link) => (
                       <Link
                         key={link.to}
                         to={link.to}
                         onClick={() => setMobileOpen(false)}
                         className="text-lg font-medium hover:text-primary transition-colors"
                       >
                         {link.label}
                       </Link>
                     ))}
                     <RoleGate allowedRoles={["host", "admin"]}>
                       <Link
                         to="/host"
                         onClick={() => setMobileOpen(false)}
                         className="text-lg font-medium hover:text-primary transition-colors"
                       >
                         Host Dashboard
                       </Link>
                     </RoleGate>
                     <RoleGate allowedRoles={["admin"]}>
                       <Link
                         to="/admin"
                         onClick={() => setMobileOpen(false)}
                         className="text-lg font-medium hover:text-primary transition-colors"
                       >
                         Admin Panel
                       </Link>
                     </RoleGate>
                     <Button variant="outline" onClick={handleSignOut}>
                       Sign out
                     </Button>
                   </>
                 )}
                 {!user && (
                   <div className="flex flex-col gap-2">
                     <Button variant="outline" asChild>
                       <Link to="/login" onClick={() => setMobileOpen(false)}>Log in</Link>
                     </Button>
                     <Button asChild>
                       <Link to="/signup" onClick={() => setMobileOpen(false)}>Sign up</Link>
                     </Button>
                   </div>
                 )}
               </nav>
             </SheetContent>
           </Sheet>
         </div>
       </div>
     </header>
   );
 }