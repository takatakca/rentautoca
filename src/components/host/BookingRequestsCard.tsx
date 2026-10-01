import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Star,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type BookingRequest = {
  id: string;
  bookingReference: string;
  startAt: string;
  endAt: string;
  totalCents: number | null;
  currency: string;
  requestedAt: string;
  requestExpiresAt: string;
  expired: boolean;
  vehicle: {
    id: string;
    label: string;
  };
  guest: {
    id: string;
    displayName: string;
    ratingAvg: number | null;
    tripsCount: number;
    idVerified: boolean;
  };
};

type ListResponse = {
  requests?: BookingRequest[];
  error?: string;
};

type ReviewResponse = {
  ok?: boolean;
  error?: string;
};

export function BookingRequestsCard() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke(
      "rentauto-host-booking-requests",
      { body: { action: "list" } },
    );

    const response = (data ?? {}) as ListResponse;
    if (error || response.error) {
      toast({
        title: "Booking requests unavailable",
        description: response.error || error?.message || "Try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setRequests(response.requests ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (
    tripId: string,
    decision: "approved" | "declined",
  ) => {
    setBusyId(tripId);

    const { data, error } = await supabase.functions.invoke(
      "rentauto-host-booking-requests",
      {
        body: {
          action: "review",
          tripId,
          decision,
        },
      },
    );

    const response = (data ?? {}) as ReviewResponse;
    setBusyId(null);

    if (error || response.error || !response.ok) {
      toast({
        title:
          decision === "approved"
            ? "Could not approve request"
            : "Could not decline request",
        description: response.error || error?.message || "Try again.",
        variant: "destructive",
      });
      await load();
      return;
    }

    toast({
      title:
        decision === "approved"
          ? "Booking request approved"
          : "Booking request declined",
      description:
        decision === "approved"
          ? "The guest has been notified and has 60 minutes to complete payment."
          : "The guest has been notified.",
    });

    setRequests((current) =>
      current.filter((request) => request.id !== tripId),
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Booking requests</CardTitle>
          <CardDescription>
            Request-only vehicles wait for your approval before the guest can pay.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No booking requests are waiting for approval.
          </p>
        ) : (
          requests.map((request) => {
            const disabled = busyId === request.id || request.expired;
            return (
              <div
                key={request.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{request.vehicle.label}</p>
                      {request.expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="secondary">Awaiting decision</Badge>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {format(new Date(request.startAt), "MMM d, yyyy h:mm a")} →{" "}
                      {format(new Date(request.endAt), "MMM d, yyyy h:mm a")}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>Guest: {request.guest.displayName}</span>
                      <span>{request.bookingReference}</span>
                      <span>
                        {request.totalCents != null
                          ? `$${(request.totalCents / 100).toFixed(2)} ${request.currency || "CAD"}`
                          : "Quote pending"}
                      </span>
                      {request.guest.ratingAvg != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {request.guest.ratingAvg.toFixed(1)}
                        </span>
                      ) : null}
                      <span>{request.guest.tripsCount} past trip{request.guest.tripsCount === 1 ? "" : "s"}</span>
                    </div>

                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Decision window ends{" "}
                      {format(new Date(request.requestExpiresAt), "MMM d, h:mm a")}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      disabled={disabled}
                      onClick={() => void review(request.id, "approved")}
                    >
                      {busyId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      onClick={() => void review(request.id, "declined")}
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
