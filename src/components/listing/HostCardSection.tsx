import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Award } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface Host {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_all_star: boolean;
  rating_avg: number | null;
  trips_count: number;
  created_at: string;
}

interface Props {
  host: Host | null;
}

export function HostCardSection({ host }: Props) {
  if (!host) return null;

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Hosted by</h2>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarImage src={host.avatar_url || ""} />
            <AvatarFallback className="text-xl">
              {(host.display_name || "H")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {host.rating_avg && (
            <div className="absolute -bottom-1 -left-1 bg-card border border-border rounded-full px-1.5 py-0.5 flex items-center gap-0.5 text-xs font-bold">
              {host.rating_avg.toFixed(1)}
              <Star className="h-3 w-3 fill-primary text-primary" />
            </div>
          )}
        </div>
        <div>
          <p className="text-lg font-bold">{host.display_name || "Host"}</p>
          <p className="text-sm text-muted-foreground">
            {host.trips_count} trips · Joined {format(new Date(host.created_at), "MMM yyyy")}
          </p>
        </div>
      </div>

      {host.is_all_star && (
        <>
          <Separator className="my-4" />
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-bold">All-Star Host</p>
              <p className="text-sm text-muted-foreground">
                All-Star Hosts like {host.display_name || "this host"} are the top-rated, most experienced hosts on RENTAUTO.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
