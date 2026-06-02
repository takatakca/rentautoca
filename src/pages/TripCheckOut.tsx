import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, Upload, MapPin, AlertTriangle } from "lucide-react";

const STEPS = ["Return", "Exterior", "Interior", "Odometer", "Fuel", "Damage", "Finish"] as const;

export default function CheckOut() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [returnConfirmed, setReturnConfirmed] = useState(false);
  const [exteriorFiles, setExteriorFiles] = useState<File[]>([]);
  const [interiorFiles, setInteriorFiles] = useState<File[]>([]);
  const [odometer, setOdometer] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [damageReported, setDamageReported] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tripId || !user) return;
    (async () => {
      const { data } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
      setTrip(data);
      setLoading(false);
    })();
  }, [tripId, user]);

  if (loading) return <div className="container py-8 max-w-2xl mx-auto space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-72 w-full" /></div>;
  if (!trip) {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <ErrorState title="Trip not found" description="We couldn't find this trip." onRetry={() => navigate("/trips")} />
      </div>
    );
  }
  if (!["active", "check_out_pending"].includes(trip.status)) {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <ErrorState title="Check-out unavailable" description={`Current status: ${trip.status.replace(/_/g, " ")}`} onRetry={() => navigate(`/trips/${tripId}`)} />
      </div>
    );
  }

  const uploadFiles = async (files: File[], kind: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${tripId}/check-out/${kind}-${Date.now()}-${i}.${f.name.split(".").pop() || "jpg"}`;
      const { error } = await supabase.storage.from("trip-photos").upload(path, f);
      if (!error) urls.push(path);
    }
    return urls;
  };

  const finish = async () => {
    if (!odometer || !fuelLevel || !returnConfirmed) {
      toast({ title: "Complete all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const extUrls = await uploadFiles(exteriorFiles, "exterior");
      const intUrls = await uploadFiles(interiorFiles, "interior");
      const { error } = await supabase.functions.invoke("trip-transition", {
        body: {
          action: "complete_check_out",
          trip_id: tripId,
          payload: {
            odometer_km: Number(odometer),
            fuel_level: fuelLevel,
            exterior_photos: extUrls,
            interior_photos: intUrls,
            damage_reported: damageReported,
            damage_notes: damageNotes,
            return_confirmed: returnConfirmed,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Trip completed", description: "Thanks! A summary has been generated." });
      navigate(`/trips/${tripId}`);
    } catch (e) {
      toast({ title: "Could not complete check-out", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-6 max-w-2xl mx-auto pb-32 space-y-4">
      <Link to={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Cancel check-out
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Check-out</h1>
        <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
      </div>
      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 0 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />Return location</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{trip.return_location || trip.pickup_location || "TBD"}</p>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={returnConfirmed} onCheckedChange={(v) => setReturnConfirmed(!!v)} /><span>The vehicle is parked at the return location.</span></label>
        </CardContent></Card>
      )}
      {step === 1 && <PhotoStep title="Exterior photos" hint="Photograph all four sides clearly." files={exteriorFiles} onChange={setExteriorFiles} />}
      {step === 2 && <PhotoStep title="Interior photos" hint="Show seats and cargo area." files={interiorFiles} onChange={setInteriorFiles} />}
      {step === 3 && (
        <Card><CardHeader><CardTitle>Final odometer</CardTitle></CardHeader><CardContent>
          <Label htmlFor="odo">Reading (km)</Label>
          <Input id="odo" type="number" inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
        </CardContent></Card>
      )}
      {step === 4 && (
        <Card><CardHeader><CardTitle>Fuel / battery level</CardTitle></CardHeader><CardContent>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)}>
            <option value="">Select level</option>
            <option value="full">Full</option><option value="3/4">3/4</option><option value="1/2">1/2</option><option value="1/4">1/4</option><option value="empty">Almost empty</option>
          </select>
        </CardContent></Card>
      )}
      {step === 5 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Report damage?</CardTitle></CardHeader><CardContent className="space-y-3">
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={damageReported} onCheckedChange={(v) => setDamageReported(!!v)} /><span>Yes, there's damage or an incident to report.</span></label>
          {damageReported && (
            <Input placeholder="Briefly describe what happened" value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} />
          )}
          {damageReported && (
            <Button variant="outline" asChild className="w-full"><Link to={`/trips/${tripId}/report-issue`}>Open full incident report</Link></Button>
          )}
        </CardContent></Card>
      )}
      {step === 6 && (
        <Card><CardHeader><CardTitle>Confirm return</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
          <p className="text-muted-foreground">Once confirmed, the trip ends and tracking stops.</p>
          <ul className="pt-2">
            <li>Odometer: <b>{odometer} km</b></li>
            <li>Fuel: <b>{fuelLevel}</b></li>
            <li>Damage reported: <b>{damageReported ? "Yes" : "No"}</b></li>
          </ul>
        </CardContent></Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 max-w-2xl mx-auto">
        {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>Back</Button>}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => setStep(step + 1)}>Continue</Button>
        ) : (
          <Button className="flex-1" onClick={finish} disabled={submitting}>{submitting ? "Finishing…" : "End trip"}</Button>
        )}
      </div>
    </div>
  );
}

function PhotoStep({ title, hint, files, onChange }: { title: string; hint: string; files: File[]; onChange: (f: File[]) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="h-4 w-4" /> {title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-8 cursor-pointer hover:bg-muted/50">
          <Upload className="h-5 w-5" /><span className="text-sm">Tap to add photos</span>
          <input type="file" accept="image/*" multiple capture="environment" className="hidden"
            onChange={(e) => onChange([...(files || []), ...Array.from(e.target.files || [])])} />
        </label>
        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" className="aspect-square object-cover rounded-md" />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
