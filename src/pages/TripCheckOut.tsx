import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Camera, MapPin, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const STEPS = ["Return", "Exterior", "Interior", "Odometer", "Fuel", "Damage", "Finish"] as const;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_GROUP = 20;
const MIN_EXTERIOR_PHOTOS = 4;
const MIN_INTERIOR_PHOTOS = 2;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function fileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic") return "heic";
  if (file.type === "image/heif") return "heif";
  return "jpg";
}

export default function CheckOut() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [trip, setTrip] = useState<Tables<"trips"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnConfirmed, setReturnConfirmed] = useState(false);
  const [exteriorFiles, setExteriorFiles] = useState<File[]>([]);
  const [interiorFiles, setInteriorFiles] = useState<File[]>([]);
  const [odometer, setOdometer] = useState("");
  const [checkInOdometer, setCheckInOdometer] = useState<number | null>(null);
  const [fuelLevel, setFuelLevel] = useState("");
  const [damageReported, setDamageReported] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tripId || !user) return;
    void (async () => {
      const [{ data: tripData }, { data: handoff }] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
        supabase
          .from("trip_handoff_snapshots")
          .select("odometer_km")
          .eq("trip_id", tripId)
          .eq("phase", "check_in")
          .maybeSingle(),
      ]);
      setTrip(tripData);
      setCheckInOdometer(handoff?.odometer_km ?? null);
      setLoading(false);
    })();
  }, [tripId, user]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-3 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <ErrorState title="Trip not found" description="We couldn't find this trip." onRetry={() => navigate("/trips")} />
      </div>
    );
  }

  if (!["active", "check_out_pending"].includes(trip.status)) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <ErrorState title="Check-out unavailable" description={`Current status: ${trip.status.replace(/_/g, " ")}`} onRetry={() => navigate(`/trips/${tripId}`)} />
      </div>
    );
  }

  const numericOdometer = Number(odometer);
  const validOdometer =
    odometer.trim() !== "" &&
    Number.isFinite(numericOdometer) &&
    numericOdometer >= 0 &&
    numericOdometer <= 10_000_000 &&
    (checkInOdometer === null || numericOdometer >= checkInOdometer);

  const damageReady = !damageReported || damageNotes.trim().length >= 10;

  const stepReady = [
    returnConfirmed,
    exteriorFiles.length >= MIN_EXTERIOR_PHOTOS,
    interiorFiles.length >= MIN_INTERIOR_PHOTOS,
    validOdometer,
    Boolean(fuelLevel),
    damageReady,
    returnConfirmed &&
      exteriorFiles.length >= MIN_EXTERIOR_PHOTOS &&
      interiorFiles.length >= MIN_INTERIOR_PHOTOS &&
      validOdometer &&
      Boolean(fuelLevel) &&
      damageReady,
  ][step];

  const addFiles = (current: File[], incoming: File[]) => {
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast({ title: "Unsupported photo", description: `${file.name} is not a supported image.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast({ title: "Photo too large", description: `${file.name} exceeds 10 MB.`, variant: "destructive" });
        continue;
      }
      accepted.push(file);
    }
    return [...current, ...accepted].slice(0, MAX_FILES_PER_GROUP);
  };

  const uploadFiles = async (files: File[], kind: "exterior" | "interior") => {
    const paths: string[] = [];
    for (const file of files) {
      const path = `${tripId}/check-out/${kind}-${crypto.randomUUID()}.${fileExtension(file)}`;
      const { error } = await supabase.storage
        .from("rentauto-trip-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) {
        throw new Error(`A ${kind} photo could not be uploaded. The return record was not completed.`);
      }
      paths.push(path);
    }
    return paths;
  };

  const finish = async () => {
    if (!stepReady) {
      toast({ title: "Complete all required return evidence first", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const [exteriorPhotos, interiorPhotos] = await Promise.all([
        uploadFiles(exteriorFiles, "exterior"),
        uploadFiles(interiorFiles, "interior"),
      ]);

      if (trip.status === "active") {
        const { error: startError } = await supabase.functions.invoke("rentauto-trip-transition", {
          body: { action: "start_check_out", trip_id: tripId },
        });
        if (startError) throw startError;
      }

      const { data, error } = await supabase.functions.invoke("rentauto-trip-transition", {
        body: {
          action: "complete_check_out",
          trip_id: tripId,
          payload: {
            odometer_km: numericOdometer,
            fuel_level: fuelLevel,
            exterior_photos: exteriorPhotos,
            interior_photos: interiorPhotos,
            damage_reported: damageReported,
            damage_notes: damageReported ? damageNotes.trim() : null,
            return_confirmed: returnConfirmed,
          },
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Check-out failed.");
      }

      toast({
        title: "Vehicle returned",
        description: damageReported
          ? "Return evidence is sealed. Your reported damage remains available for review."
          : "Return evidence is sealed and the trip is complete.",
      });
      navigate(`/trips/${tripId}`);
    } catch (error) {
      toast({
        title: "Could not complete check-out",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-4 py-6 pb-32">
      <Link to={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Cancel check-out
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vehicle return</h1>
          <p className="text-sm text-muted-foreground">Create the final condition record before ending the trip.</p>
        </div>
        <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
      </div>

      <div className="flex gap-1">
        {STEPS.map((_, index) => (
          <div key={index} className={`h-1 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Return location</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{trip.return_location || trip.pickup_location || "Return location shared with the booking."}</p>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={returnConfirmed} onCheckedChange={(value) => setReturnConfirmed(Boolean(value))} />
              <span>The vehicle is parked at the agreed return location.</span>
            </label>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <PhotoStep
          title="Exterior return evidence"
          hint="Minimum 4 photos. Match the pickup angles whenever possible."
          files={exteriorFiles}
          minimum={MIN_EXTERIOR_PHOTOS}
          onChange={(incoming) => setExteriorFiles((current) => addFiles(current, incoming))}
        />
      )}

      {step === 2 && (
        <PhotoStep
          title="Interior return evidence"
          hint="Minimum 2 photos. Capture dashboard/odometer and cabin or cargo area."
          files={interiorFiles}
          minimum={MIN_INTERIOR_PHOTOS}
          onChange={(incoming) => setInteriorFiles((current) => addFiles(current, incoming))}
        />
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Final odometer</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="odo">Reading (km)</Label>
            <Input id="odo" type="number" min={checkInOdometer ?? 0} max={10000000} inputMode="decimal" value={odometer} onChange={(event) => setOdometer(event.target.value)} />
            {checkInOdometer !== null ? (
              <p className="text-xs text-muted-foreground">Pickup odometer: {checkInOdometer} km</p>
            ) : null}
            {odometer && !validOdometer ? (
              <p className="text-xs text-destructive">Final odometer cannot be below the pickup reading.</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Fuel / battery level</CardTitle></CardHeader>
          <CardContent>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={fuelLevel} onChange={(event) => setFuelLevel(event.target.value)}>
              <option value="">Select level</option>
              <option value="full">Full</option>
              <option value="3/4">3/4</option>
              <option value="1/2">1/2</option>
              <option value="1/4">1/4</option>
              <option value="empty">Almost empty</option>
            </select>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Damage or incident</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={damageReported} onCheckedChange={(value) => setDamageReported(Boolean(value))} />
              <span>There is new damage, an accident, or another issue to document.</span>
            </label>
            {damageReported ? (
              <>
                <Textarea
                  value={damageNotes}
                  onChange={(event) => setDamageNotes(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Describe the issue in at least 10 characters."
                />
                <p className="text-xs text-muted-foreground">{damageNotes.trim().length}/2000 characters</p>
                <Button variant="outline" asChild className="w-full">
                  <Link to={`/trips/${tripId}/report-issue`}>Open detailed incident report</Link>
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader><CardTitle>Seal return record & end trip</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              This creates an immutable before/after evidence record. Active trip tracking is ended by the backend.
            </p>
            <ul className="space-y-1 pt-2">
              <li>Final odometer: <b>{odometer || "—"} km</b></li>
              {checkInOdometer !== null && validOdometer ? <li>Distance driven: <b>{numericOdometer - checkInOdometer} km</b></li> : null}
              <li>Fuel / battery: <b>{fuelLevel || "—"}</b></li>
              <li>Exterior evidence: <b>{exteriorFiles.length} photos</b></li>
              <li>Interior evidence: <b>{interiorFiles.length} photos</b></li>
              <li>Damage reported: <b>{damageReported ? "Yes" : "No"}</b></li>
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-2xl gap-2 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {step > 0 ? <Button variant="outline" onClick={() => setStep((current) => current - 1)} disabled={submitting}>Back</Button> : null}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1" onClick={() => setStep((current) => current + 1)} disabled={!stepReady}>Continue</Button>
        ) : (
          <Button className="flex-1" onClick={() => void finish()} disabled={submitting || !stepReady}>
            {submitting ? "Sealing evidence…" : "Seal record & end trip"}
          </Button>
        )}
      </div>
    </div>
  );
}

function PhotoStep({
  title,
  hint,
  files,
  minimum,
  onChange,
}: {
  title: string;
  hint: string;
  files: File[];
  minimum: number;
  onChange: (files: File[]) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="h-4 w-4" /> {title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <div className="flex items-center justify-between text-xs">
          <span>{files.length} selected</span>
          <span className={files.length >= minimum ? "text-success" : "text-muted-foreground"}>Minimum {minimum}</span>
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 hover:bg-muted/50">
          <Upload className="h-5 w-5" />
          <span className="text-sm">Take or add photos</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            capture="environment"
            className="hidden"
            onChange={(event) => {
              onChange(Array.from(event.target.files || []));
              event.currentTarget.value = "";
            }}
          />
        </label>
        {files.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {files.map((file, index) => (
              <img key={`${file.name}-${index}`} src={URL.createObjectURL(file)} alt="" className="aspect-square rounded-md object-cover" />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
