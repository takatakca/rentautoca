import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Incident = {
  id: string;
  tripId: string;
  bookingReference: string | null;
  tripStatus: string | null;
  reporterUserId: string;
  reporter: { displayName: string | null; email: string | null };
  type: string;
  description: string | null;
  severity: string;
  status: string;
  resolutionCode: string | null;
  resolutionNotes: string | null;
  resolvedAmountCents: number | null;
  reviewedAt: string | null;
  evidenceHash: string | null;
  createdAt: string;
  vehicle: {
    id: string;
    title: string | null;
    year: number;
    make: string;
    model: string;
    hostId: string;
    host: { displayName: string | null; email: string | null };
  } | null;
  photoUrls: string[];
};

type ReviewDraft = {
  status: "reviewing" | "resolved" | "closed";
  resolutionCode: string;
  resolutionNotes: string;
  amountDollars: string;
};

const DEFAULT_DRAFT: ReviewDraft = {
  status: "reviewing",
  resolutionCode: "",
  resolutionNotes: "",
  amountDollars: "",
};

function severityVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  if (severity === "safety") return "destructive";
  if (severity === "urgent") return "default";
  return "secondary";
}

export default function AdminTripIncidents() {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState("open");
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-trip-incidents",
      { body: { action: "list", status: filter } },
    );

    const response = (data ?? {}) as { incidents?: Incident[]; error?: string };
    if (invokeError || response.error) {
      setError(response.error ?? "Incident queue could not be loaded.");
      setIncidents([]);
    } else {
      setIncidents(response.incidents ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const draftFor = (incident: Incident): ReviewDraft =>
    drafts[incident.id] ?? {
      status:
        incident.status === "resolved" || incident.status === "closed"
          ? incident.status
          : "reviewing",
      resolutionCode: incident.resolutionCode ?? "",
      resolutionNotes: incident.resolutionNotes ?? "",
      amountDollars:
        incident.resolvedAmountCents == null
          ? ""
          : (incident.resolvedAmountCents / 100).toFixed(2),
    };

  const setDraft = (incidentId: string, patch: Partial<ReviewDraft>) => {
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident) return;
    setDrafts((current) => ({
      ...current,
      [incidentId]: { ...draftFor(incident), ...patch },
    }));
  };

  const review = async (incident: Incident) => {
    const draft = draftFor(incident);
    const amount = draft.amountDollars.trim() === ""
      ? null
      : Math.round(Number(draft.amountDollars) * 100);

    if (
      amount !== null &&
      (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000)
    ) {
      toast({ title: "Invalid assessed amount", variant: "destructive" });
      return;
    }

    if (
      (draft.status === "resolved" || draft.status === "closed") &&
      (!draft.resolutionCode.trim() || draft.resolutionNotes.trim().length < 10)
    ) {
      toast({
        title: "Resolution details required",
        description: "Add a resolution code and at least 10 characters of review notes.",
        variant: "destructive",
      });
      return;
    }

    setBusyId(incident.id);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-trip-incidents",
      {
        body: {
          action: "review",
          incidentId: incident.id,
          status: draft.status,
          resolutionCode: draft.resolutionCode.trim() || null,
          resolutionNotes: draft.resolutionNotes.trim() || null,
          resolvedAmountCents: amount,
        },
      },
    );
    setBusyId(null);

    const response = (data ?? {}) as { ok?: boolean; error?: string };
    if (invokeError || response.error || !response.ok) {
      toast({
        title: "Incident review failed",
        description: response.error ?? "Could not save the decision.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Incident updated",
      description: "The decision was added to the audit trail and both trip participants were notified.",
    });
    await load();
  };

  return (
    <div className="container max-w-6xl py-8 pb-24">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Admin control center
          </Link>
          <h1 className="text-3xl font-bold">Trip claims & incidents</h1>
          <p className="mt-1 text-muted-foreground">
            Review sealed evidence, document the decision and preserve a complete audit trail.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <div className="flex gap-3">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Decision layer only</p>
            <p className="mt-1 text-muted-foreground">
              An assessed amount records the claim decision. It does not automatically charge a guest, refund a payment, or release a host payout.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : incidents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No incidents match this queue.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {incidents.map((incident) => {
            const draft = draftFor(incident);
            const vehicleName = incident.vehicle
              ? incident.vehicle.title?.trim() ||
                `${incident.vehicle.year} ${incident.vehicle.make} ${incident.vehicle.model}`
              : "Vehicle";

            return (
              <Card key={incident.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        {incident.type.replace(/_/g, " ")}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {vehicleName} · Booking {incident.bookingReference ?? incident.tripId.slice(0, 8)}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={severityVariant(incident.severity)} className="capitalize">
                        {incident.severity}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {incident.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Reporter</p>
                      <p className="font-medium">
                        {incident.reporter.displayName || incident.reporter.email || incident.reporterUserId}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Reported</p>
                      <p className="font-medium">{new Date(incident.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                    <p className="whitespace-pre-wrap">{incident.description || "No description."}</p>
                    {incident.evidenceHash ? (
                      <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">
                        Evidence SHA-256: {incident.evidenceHash}
                      </p>
                    ) : null}
                  </div>

                  {incident.photoUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {incident.photoUrls.map((url, index) => (
                        <Button asChild key={url} size="sm" variant="outline">
                          <a href={url} target="_blank" rel="noreferrer">
                            Evidence {index + 1} <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={draft.status}
                        onChange={(event) => setDraft(incident.id, { status: event.target.value as ReviewDraft["status"] })}
                        disabled={incident.status === "closed"}
                      >
                        <option value="reviewing">Reviewing</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Resolution code</label>
                      <Input
                        value={draft.resolutionCode}
                        onChange={(event) => setDraft(incident.id, { resolutionCode: event.target.value })}
                        placeholder="e.g. guest_damage"
                        maxLength={100}
                        disabled={incident.status === "closed"}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Assessed amount (CAD)</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.amountDollars}
                        onChange={(event) => setDraft(incident.id, { amountDollars: event.target.value })}
                        placeholder="0.00"
                        disabled={incident.status === "closed"}
                      />
                    </div>
                  </div>

                  <Textarea
                    value={draft.resolutionNotes}
                    onChange={(event) => setDraft(incident.id, { resolutionNotes: event.target.value })}
                    rows={4}
                    maxLength={4000}
                    placeholder="Document evidence reviewed, conclusion and next action."
                    disabled={incident.status === "closed"}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link to={`/trips/${incident.tripId}`}>Open trip</Link>
                    </Button>
                    {incident.status !== "closed" ? (
                      <Button onClick={() => void review(incident)} disabled={busyId === incident.id}>
                        <ShieldCheck className="h-4 w-4" />
                        {busyId === incident.id ? "Saving…" : "Save review"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
