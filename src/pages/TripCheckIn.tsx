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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, Upload, ShieldCheck, MapPin } from "lucide-react";

const STEPS = ["Identity", "Pickup", "Exterior", "Interior", "Odometer", "Fuel", "Consent", "Start"] as const;

export default function CheckIn() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  const [exteriorFiles, setExteriorFiles] = useState<File[]>([]);
  const [interiorFiles, setInteriorFiles] = useState<File[]>([]);
  const [odometer, setOdometer] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [conditionOk, setConditionOk] = useState(false);
  const [trackingConsent, setTrackingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tripId || !user) return;
    (async () => {
      const { data } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
      setTrip(data);
      setLoading(false);
    })();
  }, [tripId, user]);

  if (loading) {
    return <div className="container py-8 max-w-2xl mx-auto"><Skeleton className="h-72 w-full" /></div>;
  }
  if (!trip) {
    return (
      <div className="container py-8 max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-bold mb-2">Trip not found</h1>
        <Button asChild variant="outline"><Link to="/trips">Back to trips</Link></Button>
      </div>
    );
  }
  if (trip.guest_id !== user?.id) {
    return <div className="container py-8 max-w-2xl mx-auto text-center"><h1 className="text-xl font-bold">Not authorized</h1></div>;
  }
  if (!["confirmed", "check_in_pending"].includes(trip.status)) {
    return (
      <div className="container py-8 max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-bold mb-2">Check-in unavailable</h1>
        <p className="text-muted-foreground mb-4">Status: {trip.status}</p>
        <Button asChild variant="outline"><Link to={`/trips/${tripId}`}>Back to trip</Link></Button>
      </div>
    );
  }

  const uploadFiles = async (files: File[], kind: "exterior" | "interior"): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${tripId}/check-in/${kind}-${Date.now()}-${i}.${f.name.split(".").pop() || "jpg"}`;
      const { error } = await supabase.storage.from("trip-photos").upload(path, f, { upsert: false });
      if (!error) urls.push(path);
    }
    return urls;
  };

  const finish = async () => {
    if (!odometer || !fuelLevel || !conditionOk || !trackingConsent) {
      toast({ title: "Complete all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const extUrls = await uploadFiles(exteriorFiles, "exterior");
      const intUrls = await uploadFiles(interiorFiles, "interior");
      // start_check_in (confirmed -> check_in_pending) if needed
      if (trip.status === "confirmed") {
        await supabase.functions.invoke("trip-transition", { body: { action: "start_check_in", trip_id: tripId } });
      }
      const { error } = await supabase.functions.invoke("trip-transition", {
        body: {
          action: "complete_check_in",
          trip_id: tripId,
          payload: {
            odometer_km: Number(odometer),
            fuel_level: fuelLevel,
            exterior_photos: extUrls,
            interior_photos: intUrls,
            pickup_confirmed: pickupConfirmed,
            consent_accepted_at: new Date().toISOString(),
          },
        },
      });
      if (error) throw error;
      toast({ title: "Trip started", description: "Tracking is now active. Drive safe!" });
      navigate(`/trips/${tripId}`);
    } catch (e) {
      toast({ title: "Could not complete check-in", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-6 max-w-2xl mx-auto pb-24 space-y-4">
      <Link to={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Cancel check-in
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Check-in</h1>
        <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
      </div>
      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 0 && (
        <Card><CardHeader><CardTitle>Identity & license</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Confirm your driver's license is valid and matches the booking.</p>
          <label className="flex items-start gap-2"><Checkbox checked={conditionOk} onCheckedChange={(v) => setConditionOk(!!v)} /><span>My license is valid and I'm present at pickup.</span></label>
        </CardContent></Card>
      )}
      {step === 1 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Pickup location</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{trip.pickup_location || "TBD"}</p>
          <label className="flex items-start gap-2"><Checkbox checked={pickupConfirmed} onCheckedChange={(v) => setPickupConfirmed(!!v)} /><span>I'm at the pickup location.</span></label>
        </CardContent></Card>
      )}
      {step === 2 && (
        <PhotoStep title="Exterior photos" hint="Walk around and capture all four sides + any pre-existing damage." files={exteriorFiles} onChange={setExteriorFiles} />
      )}
      {step === 3 && (
        <PhotoStep title="Interior photos" hint="Capture seats, dashboard, and cargo area." files={interiorFiles} onChange={setInteriorFiles} />
      )}
      {step === 4 && (
        <Card><CardHeader><CardTitle>Odometer reading</CardTitle></CardHeader><CardContent className="space-y-3">
          <Label htmlFor="odo">Current odometer (km)</Label>
          <Input id="odo" type="number" inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="e.g. 45230" />
        </CardContent></Card>
      )}
      {step === 5 && (
        <Card><CardHeader><CardTitle>Fuel / battery level</CardTitle></CardHeader><CardContent className="space-y-3">
          <Label htmlFor="fuel">Level</Label>
          <select id="fuel" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={fuelLevel} onChange={(e) => setFuelLevel(e.target.value)}>
            <option value="">Select level</option>
            <option value="full">Full</option>
            <option value="3/4">3/4</option>
            <option value="1/2">1/2</option>
            <option value="1/4">1/4</option>
            <option value="empty">Almost empty</option>
          </select>
        </CardContent></Card>
      )}
      {step === 6 && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Tracking consent</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            By starting this trip, you acknowledge the vehicle may be tracked via telematics during the active rental window only.
            Tracking ends automatically at check-out.
          </p>
          <label className="flex items-start gap-2"><Checkbox checked={trackingConsent} onCheckedChange={(v) => setTrackingConsent(!!v)} /><span>I consent to vehicle tracking for the duration of this active trip.</span></label>
        </CardContent></Card>
      )}
      {step === 7 && (
        <Card><CardHeader><CardTitle>Start your trip</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Review your check-in. Once started, the trip becomes active and tracking begins.</p>
          <ul className="text-sm space-y-1">
            <li>Odometer: <b>{odometer || "—"} km</b></li>
            <li>Fuel: <b>{fuelLevel || "—"}</b></li>
            <li>Exterior photos: <b>{exteriorFiles.length}</b></li>
            <li>Interior photos: <b>{interiorFiles.length}</b></li>
          </ul>
        </CardContent></Card>
      )}

      <div className="flex gap-2">
        {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>Back</Button>}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => setStep(step + 1)}>Continue</Button>
        ) : (
          <Button className="flex-1" onClick={finish} disabled={submitting}>{submitting ? "Starting…" : "Start trip"}</Button>
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
          <Upload className="h-5 w-5" />
          <span className="text-sm">Tap to add photos</span>
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => onChange([...(files || []), ...Array.from(e.target.files || [])])}
          />
        </label>
        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <img key={i} src={URL.createObjectURL(f)} alt="" className="aspect-square object-cover rounded-md" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
