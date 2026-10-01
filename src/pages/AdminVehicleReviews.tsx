import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ReviewVehicle = {
  id: string;
  hostId: string;
  title: string;
  make: string;
  model: string;
  year: number;
  status: string;
  insuranceStatus: string;
  vin: string | null;
  plateNumber: string | null;
  updatedAt: string;
  host: { displayName: string | null; email: string | null };
  registrationDocumentUrl: string | null;
  insuranceDocumentUrl: string | null;
};

export default function AdminVehicleReviews() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<ReviewVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-vehicle-reviews",
      { body: { action: "list", status: "pending" } },
    );
    const response = (data ?? {}) as { vehicles?: ReviewVehicle[]; error?: string };
    if (invokeError || response.error) {
      setError(response.error ?? "Vehicle reviews could not be loaded.");
      setVehicles([]);
    } else {
      setVehicles(response.vehicles ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (carId: string, decision: "verified" | "rejected") => {
    setBusyId(carId);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-admin-vehicle-reviews",
      { body: { action: "review", carId, decision, notes: notes[carId]?.trim() || null } },
    );
    const response = (data ?? {}) as { ok?: boolean; error?: string };
    setBusyId(null);
    if (invokeError || response.error || !response.ok) {
      toast({ title: "Review failed", description: response.error ?? "Could not save review.", variant: "destructive" });
      return;
    }
    toast({
      title: decision === "verified" ? "Vehicle documents approved" : "Vehicle documents rejected",
      description: "The host has been notified automatically.",
    });
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== carId));
  };

  return (
    <div className="container max-w-6xl py-8 pb-24">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Admin control center
          </Link>
          <h1 className="text-3xl font-bold">Vehicle document reviews</h1>
          <p className="mt-1 text-muted-foreground">Approve or reject registration and insurance before a host can publish.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {error ? <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : vehicles.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No vehicle documents are waiting for review.</CardContent></Card>
      ) : (
        <div className="grid gap-5">
          {vehicles.map((vehicle) => (
            <Card key={vehicle.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{vehicle.title || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}</CardTitle>
                    <CardDescription>
                      {vehicle.year} {vehicle.make} {vehicle.model} · Host: {vehicle.host.displayName || vehicle.host.email || vehicle.hostId}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">Pending review</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><span className="text-muted-foreground">VIN:</span> <span className="font-mono">{vehicle.vin || "Missing"}</span></div>
                  <div><span className="text-muted-foreground">Plate:</span> {vehicle.plateNumber || "Missing"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {vehicle.registrationDocumentUrl ? (
                    <Button asChild variant="outline" size="sm"><a href={vehicle.registrationDocumentUrl} target="_blank" rel="noreferrer">Registration <ExternalLink className="h-3.5 w-3.5" /></a></Button>
                  ) : <Badge variant="destructive">Registration missing</Badge>}
                  {vehicle.insuranceDocumentUrl ? (
                    <Button asChild variant="outline" size="sm"><a href={vehicle.insuranceDocumentUrl} target="_blank" rel="noreferrer">Insurance <ExternalLink className="h-3.5 w-3.5" /></a></Button>
                  ) : <Badge variant="destructive">Insurance missing</Badge>}
                </div>
                <Textarea
                  value={notes[vehicle.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [vehicle.id]: event.target.value }))}
                  placeholder="Rejection reason or internal review note (recommended when rejecting)"
                  maxLength={2000}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void review(vehicle.id, "verified")} disabled={busyId === vehicle.id || !vehicle.registrationDocumentUrl || !vehicle.insuranceDocumentUrl || !vehicle.vin || !vehicle.plateNumber}>
                    <ShieldCheck className="h-4 w-4" /> Approve documents
                  </Button>
                  <Button variant="destructive" onClick={() => void review(vehicle.id, "rejected")} disabled={busyId === vehicle.id}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
