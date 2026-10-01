import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Fingerprint,
  Fuel,
  Gauge,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Snapshot = Tables<"trip_handoff_snapshots">;
type Incident = Pick<
  Tables<"trip_incidents">,
  "id" | "type" | "severity" | "status" | "created_at" | "description"
>;

type SignedSnapshot = Snapshot & {
  signedExterior: string[];
  signedInterior: string[];
};

async function signPaths(paths: string[]) {
  const signed = await Promise.all(
    paths.slice(0, 8).map(async (path) => {
      const { data } = await supabase.storage
        .from("rentauto-trip-photos")
        .createSignedUrl(path, 600);
      return data?.signedUrl ?? null;
    }),
  );
  return signed.filter((url): url is string => Boolean(url));
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "open") return "destructive";
  if (status === "reviewing") return "default";
  if (status === "resolved") return "secondary";
  return "outline";
}

export function TripEvidenceCard({ tripId }: { tripId: string }) {
  const [snapshots, setSnapshots] = useState<SignedSnapshot[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      const [snapshotResult, incidentResult] = await Promise.all([
        supabase
          .from("trip_handoff_snapshots")
          .select("*")
          .eq("trip_id", tripId)
          .order("submitted_at", { ascending: true }),
        supabase
          .from("trip_incidents")
          .select("id,type,severity,status,created_at,description")
          .eq("trip_id", tripId)
          .order("created_at", { ascending: false }),
      ]);

      const signedSnapshots = await Promise.all(
        (snapshotResult.data ?? []).map(async (snapshot) => ({
          ...snapshot,
          signedExterior: await signPaths(snapshot.exterior_photos),
          signedInterior: await signPaths(snapshot.interior_photos),
        })),
      );

      if (!active) return;
      setSnapshots(signedSnapshots);
      setIncidents(incidentResult.data ?? []);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [tripId]);

  const checkIn = useMemo(
    () => snapshots.find((snapshot) => snapshot.phase === "check_in") ?? null,
    [snapshots],
  );
  const checkOut = useMemo(
    () => snapshots.find((snapshot) => snapshot.phase === "check_out") ?? null,
    [snapshots],
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading trip evidence…
        </CardContent>
      </Card>
    );
  }

  if (!checkIn && !checkOut && incidents.length === 0) return null;

  const distance =
    checkIn && checkOut ? Math.max(0, checkOut.odometer_km - checkIn.odometer_km) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> Trip evidence record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          {checkIn ? <SnapshotPanel snapshot={checkIn} title="Pickup" /> : <MissingPanel title="Pickup record" />}
          {checkOut ? <SnapshotPanel snapshot={checkOut} title="Return" /> : <MissingPanel title="Return record" />}
        </div>

        {checkIn && checkOut ? (
          <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Distance driven</p>
              <p className="mt-1 flex items-center gap-2 font-semibold">
                <Gauge className="h-4 w-4" /> {distance} km
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fuel / battery</p>
              <p className="mt-1 flex items-center gap-2 font-semibold">
                <Fuel className="h-4 w-4" /> {checkIn.fuel_level} → {checkOut.fuel_level}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Return damage</p>
              <p className="mt-1 font-semibold">{checkOut.damage_reported ? "Reported" : "None reported"}</p>
            </div>
          </div>
        ) : null}

        {incidents.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Trip incidents</p>
            {incidents.map((incident) => (
              <div key={incident.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium capitalize">
                    <AlertTriangle className="h-4 w-4" />
                    {incident.type.replace(/_/g, " ")}
                  </p>
                  {incident.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{incident.description}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(incident.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={incident.severity === "safety" ? "destructive" : "secondary"} className="capitalize">
                    {incident.severity}
                  </Badge>
                  <Badge variant={statusVariant(incident.status)} className="capitalize">
                    {incident.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SnapshotPanel({ snapshot, title }: { snapshot: SignedSnapshot; title: string }) {
  const photoCount = snapshot.exterior_photos.length + snapshot.interior_photos.length;
  const signed = [...snapshot.signedExterior, ...snapshot.signedInterior];

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <Badge variant="secondary">Sealed</Badge>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <p><span className="text-muted-foreground">Odometer:</span> {snapshot.odometer_km} km</p>
        <p><span className="text-muted-foreground">Fuel / battery:</span> {snapshot.fuel_level}</p>
        <p><span className="text-muted-foreground">Evidence:</span> {photoCount} photos</p>
        <p><span className="text-muted-foreground">Sealed:</span> {new Date(snapshot.submitted_at).toLocaleString()}</p>
      </div>

      {signed.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {signed.map((url, index) => (
            <Button asChild variant="outline" size="sm" key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                <Camera className="h-3.5 w-3.5" /> Photo {index + 1}
              </a>
            </Button>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-start gap-2 break-all rounded-md bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
        <Fingerprint className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {snapshot.evidence_hash}
      </div>
    </div>
  );
}

function MissingPanel({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1">Not sealed yet.</p>
    </div>
  );
}
