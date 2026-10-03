import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Car,
  ChevronRight,
  CreditCard,
  FileText,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Route,
  Shield,
  User,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

type HubLink = {
  to: string;
  label: string;
  description: string;
  icon: typeof User;
  show?: boolean;
};

export default function More() {
  const { user, hasRole, signOut } = useAuth();
  const navigate = useNavigate();

  const primary: HubLink[] = [
    {
      to: "/dashboard",
      label: "Dashboard",
      description: "Your Rentauto overview and readiness",
      icon: LayoutDashboard,
    },
    {
      to: "/profile",
      label: "Profile",
      description: "Personal details and TAKATAK identity",
      icon: User,
    },
    {
      to: "/trips",
      label: "Trips",
      description: "Upcoming, active and past rentals",
      icon: Route,
    },
    {
      to: "/favorites",
      label: "Favorites",
      description: "Cars you saved for later",
      icon: Heart,
    },
    {
      to: "/messages",
      label: "Messages",
      description: "Conversations with hosts and guests",
      icon: MessageSquare,
    },
    {
      to: "/dashboard/notifications",
      label: "Notifications",
      description: "Booking, verification and account updates",
      icon: Bell,
    },
  ];

  const account: HubLink[] = [
    {
      to: "/dashboard/documents",
      label: "Documents & verification",
      description: "Driver verification and required documents",
      icon: FileText,
    },
    {
      to: "/dashboard/payments",
      label: "Payments",
      description: "Payment and payout information",
      icon: CreditCard,
    },
    {
      to: "/dashboard/security",
      label: "Security",
      description: "Account access and security controls",
      icon: LockKeyhole,
    },
    {
      to: "/dashboard/support",
      label: "Support",
      description: "Get help with your account or a trip",
      icon: HelpCircle,
    },
  ];

  const business: HubLink[] = [
    {
      to: "/become-host",
      label: "Become a host",
      description: "Apply to list a vehicle",
      icon: UserPlus,
      show: !hasRole("host") && !hasRole("admin"),
    },
    {
      to: "/host",
      label: "Host dashboard",
      description: "Fleet, bookings and earnings",
      icon: Car,
      show: hasRole("host") || hasRole("admin"),
    },
    {
      to: "/admin",
      label: "Admin",
      description: "Marketplace operations and review",
      icon: Shield,
      show: hasRole("admin"),
    },
  ];

  const renderLinks = (links: HubLink[]) => (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {links
        .filter((item) => item.show !== false)
        .map((item, index, visible) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 " +
                (index < visible.length - 1 ? "border-b" : "")
              }
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          );
        })}
    </div>
  );

  return (
    <div className="container mx-auto max-w-2xl px-4 pb-28 pt-6 sm:pt-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">RENTAUTO.CA</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">More</h1>
        <p className="mt-2 text-muted-foreground">
          Everything outside the drive flow, organized in one place.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Your account
        </h2>
        {renderLinks(primary)}
      </section>

      <section className="mt-7 space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Account & support
        </h2>
        {renderLinks(account)}
      </section>

      <section className="mt-7 space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Hosting & operations
        </h2>
        {renderLinks(business)}
      </section>

      <section className="mt-7">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Link className="rounded-xl border px-4 py-3 hover:bg-muted/60" to="/help">Help centre</Link>
          <Link className="rounded-xl border px-4 py-3 hover:bg-muted/60" to="/safety">Safety</Link>
          <Link className="rounded-xl border px-4 py-3 hover:bg-muted/60" to="/privacy">Privacy</Link>
          <Link className="rounded-xl border px-4 py-3 hover:bg-muted/60" to="/terms">Terms</Link>
        </div>
      </section>

      {user && (
        <Button
          variant="outline"
          className="mt-7 w-full"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      )}
    </div>
  );
}
