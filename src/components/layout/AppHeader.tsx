import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Car,
  Heart,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Route,
  Shield,
  Smartphone,
  User,
  UserPlus,
} from "lucide-react";
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const overHero = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const transparent = overHero && !scrolled;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const navLinks = [
    { to: "/explore", label: "Find a car" },
    { to: "/how-it-works", label: "How it works" },
    { to: "/become-host", label: "List your car" },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-300",
        overHero && "-mb-16",
        transparent
          ? "border-b border-transparent bg-transparent"
          : "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2" aria-label="Rentauto.ca home">
            <Car className={cn("h-8 w-8", transparent ? "text-overlay-foreground" : "text-primary")} />
            <span className={cn("text-xl font-bold", transparent ? "text-overlay-foreground" : "text-foreground")}>
              Rentauto.ca
            </span>
          </Link>

          <nav className="hidden items-center gap-4 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "text-sm font-medium transition-colors",
                  transparent
                    ? "text-overlay-foreground/80 hover:text-overlay-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <AccountMenu
            user={user}
            transparent={transparent}
            hasRole={hasRole}
            onSignOut={handleSignOut}
          />

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className={cn(transparent && "text-overlay-foreground hover:bg-white/10 hover:text-white")}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 max-w-[88vw]">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1">
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Rentauto
                </p>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-3 py-3 text-base font-medium hover:bg-secondary"
                  >
                    {link.label}
                  </Link>
                ))}

                <DropdownMenuSeparator className="my-3" />

                {user ? (
                  <>
                    <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-secondary">
                      My dashboard
                    </Link>
                    <Link to="/trips" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-secondary">
                      Trips
                    </Link>
                    <Link to="/favorites" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-secondary">
                      Favorites
                    </Link>
                    <Link to="/messages" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-secondary">
                      Messages
                    </Link>
                    <RoleGate allowedRoles={["host", "admin"]}>
                      <Link to="/host" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-secondary">
                        Host dashboard
                      </Link>
                    </RoleGate>
                    <RoleGate allowedRoles={["admin"]}>
                      <Link to="/admin" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-secondary">
                        Admin
                      </Link>
                    </RoleGate>
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={async () => {
                        setMobileOpen(false);
                        await handleSignOut();
                      }}
                    >
                      Sign out
                    </Button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Button asChild className="w-full justify-start">
                      <Link to="/login?mode=sms" onClick={() => setMobileOpen(false)}>
                        Continue with SMS
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link to="/login?mode=password" onClick={() => setMobileOpen(false)}>
                        Continue by email
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link to="/login?provider=google" onClick={() => setMobileOpen(false)}>
                        Continue with Google
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" className="w-full justify-start">
                      <Link to="/signup" onClick={() => setMobileOpen(false)}>
                        Create an account
                      </Link>
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

function AccountMenu({
  user,
  transparent,
  hasRole,
  onSignOut,
}: {
  user: ReturnType<typeof useAuth>["user"];
  transparent: boolean;
  hasRole: ReturnType<typeof useAuth>["hasRole"];
  onSignOut: () => Promise<void>;
}) {
  if (!user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "gap-2 rounded-full px-3",
              transparent && "text-overlay-foreground hover:bg-white/10 hover:text-white",
            )}
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2">
          <div className="px-2 pb-2 pt-1">
            <p className="text-sm font-semibold">TAKATAK account</p>
            <p className="text-xs text-muted-foreground">One identity for Rentauto and connected GROUPE TAKATAK services.</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/login?mode=sms" className="flex cursor-pointer items-center gap-2 rounded-lg">
              <Smartphone className="h-4 w-4" /> Continue with SMS / OTP
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/login?mode=password" className="flex cursor-pointer items-center gap-2 rounded-lg">
              <Mail className="h-4 w-4" /> Continue by email
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/login?provider=google" className="flex cursor-pointer items-center gap-2 rounded-lg">
              <User className="h-4 w-4" /> Continue with Google
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/signup" className="flex cursor-pointer items-center gap-2 rounded-lg font-medium">
              <UserPlus className="h-4 w-4" /> Create an account
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="sr-only">Open account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-semibold">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {hasRole("admin") ? "Admin" : hasRole("host") ? "Host + guest" : "Guest"} · TAKATAK identity
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard" className="flex cursor-pointer items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> My dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/trips" className="flex cursor-pointer items-center gap-2">
            <Route className="h-4 w-4" /> Trips
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/favorites" className="flex cursor-pointer items-center gap-2">
            <Heart className="h-4 w-4" /> Favorites
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/messages" className="flex cursor-pointer items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Messages
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex cursor-pointer items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </Link>
        </DropdownMenuItem>
        <RoleGate allowedRoles={["host", "admin"]}>
          <DropdownMenuItem asChild>
            <Link to="/host" className="flex cursor-pointer items-center gap-2">
              <Car className="h-4 w-4" /> Host dashboard
            </Link>
          </DropdownMenuItem>
        </RoleGate>
        <RoleGate allowedRoles={["admin"]}>
          <DropdownMenuItem asChild>
            <Link to="/admin" className="flex cursor-pointer items-center gap-2">
              <Shield className="h-4 w-4" /> Admin
            </Link>
          </DropdownMenuItem>
        </RoleGate>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void onSignOut()} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
