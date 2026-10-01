import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, MapPin, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const STEPS = ["Identity", "Pickup", "Exterior", "Interior", "Odometer", "Fuel", "Consent", "Start"] as const;
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

type DriverVerification = Pick<
  Tables<"driver_verifications">,
  "status" | "license_expires_on"
>;

function fileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/heic") return "heic";
  if (file.type === "image/heif") return "heif";
  return "jpg";
}

export default function CheckIn() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [trip, setTrip] = useState<Tables<"trips"> | null>(null);
  const [driverVerification, setDriverVerification] = useState<DriverVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [exteriorFiles, setExteriorFiles] = useState<File[]>([]);
  const [interiorFiles, setInteriorFiles] = useState<File[]>([]);
  const [odometer, setOdometer] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [trackingConsent, setTrackingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tripId || !user) return;
    void (async () => {
      const [{ data: tripData }, { data: verification }] = await Promise.all([
        supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
        supabase
          .from("driver_verifications")
          .select("status,license_expires_on")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setTrip(tripData);
      setDriverVerification(verification);
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
        <ErrorState title="Trip not found" description="This trip may have been cancelled or removed." onRetry={() => navigate("/trips")} />
      </div>
    );
  }

  if (trip.guest_id !== user?.id) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <ErrorState title="Not authorized" description="Only the booked driver can complete check-in." onRetry={() => navigate("/trips")} />
      </div>
    );
  }

  if (!["confirmed", "check_in_pending"].includes(trip.status)) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <ErrorState title="Check-in unavailable" description={`Current status: ${trip.status.replace(/_/g, " ")}`} onRetry={() => navigate(`/trips/${tripId}`)} />
      </div>
    );
  }

  const licenseIsCurrent =
    driverVerification?.status === "approved" &&
    Boolean(driverVerification.license_expires_on) &&
    new Date(`${driverVerification.license_expires_on}T23:59:59`).getTime() >= Date.now();

  const validOdometer =
    odometer.trim() !== "" &&
    Number.isFinite(Number(odometer)) &&
    Number(odometer) >= 0 &&
    Number(odometer) <= 10_000_000;

  const stepReady = [
    licenseIsCurrent && identityConfirmed,
    pickupConfirmed,
    exteriorFiles.length >= MIN_EXTERIOR_PHOTOS,
    interiorFiles.length >= MIN_INTERIOR_PHOTOS,
    validOdometer,
    Boolean(fuelLevel),
    trackingConsent,
    licenseIsCurrent &&
      pickupConfirmed &&
      exteriorFiles.length >= MIN_EXTERIOR_PHOTOS &&
      interiorFiles.length >= MIN_INTERIOR_PHOTOS &&
      validOdometer &&
      Boolean(fuelLevel) &&
      trackingConsent,
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
      const path = `${tripId}/check-in/${kind}-${crypto.randomUUID()}.${fileExtension(file)}`;
      const { error } = await supabase.storage
        .from("rentauto-trip-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) {
        throw new Error(`A ${kind} photo could not be uploaded. No check-in was completed.`);
      }
      paths.push(path);
    }
    return paths;
  };

  const finish = async () => {
    if (!stepReady) {
      toast({ title: "Complete all required evidence first", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const [exteriorPhotos, interiorPhotos] = await Promise.all([
        uploadFiles(exteriorFiles, "exterior"),
        uploadFiles(interiorFiles, "interior"),
      ]);

      if (trip.status === "confirmed") {
        const { error: startError } = await supabase.functions.invoke("rentauto-trip-transition", {
          body: { action: "start_check_in", trip_id: tripId },
        });
        if (startError) throw startError;
      }

      const { data, error } = await supabase.functions.invoke("rentauto-trip-transition", {
        body: {
          action: "complete_check_in",
          trip_id: tripId,
          payload: {
            odometer_km: Number(odometer),
            fuel_level: fuelLevel,
            exterior_photos: exteriorPhotos,
            interior_photos: interiorPhotos,
            pickup_confirmed: pickupConfirmed,
            consent_accepted_at: new Date().toISOString(),
          },
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Check-in failed.");
      }

      toast({
        title: "Trip started",
        description: "Your pickup evidence has been sealed and tracking is active.",
      });
      navigate(`/trips/${tripId}`);
    } catch (error) {
      toast({
        title: "Could not complete check-in",
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
        <ArrowLeft className="h-4 w-4" /> Cancel check-in
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vehicle handoff</h1>
          <p className="text-sm text-muted-foreground">Create the pickup condition record before driving away.</p>
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
          <CardHeader><CardTitle>Identity & driver licence</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className={`rounded-lg border p-3 ${licenseIsCurrent ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
              <p className="font-medium">{licenseIsCurrent ? "Driver verification approved" : "Driver verification required"}</p>
              <p className="mt-1 text-muted-foreground">
                {licenseIsCurrent
                  ? `Licence valid through ${driverVerification?.license_expires_on}.`
                  : "Your approved driver verification must still be valid on pickup day."}
              </p>
              {!licenseIsCurrent ? (
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link to="/dashboard/documents">Review driver documents</Link>
                </Button>
              ) : null}
            </div>
            <label className="flex items-start gap-2">
              <Checkbox checked={identityConfirmed} onCheckedChange={(value) => setIdentityConfirmed(Boolean(value))} disabled={!licenseIsCurrent} />
              <span>I am the verified driver named on this booking and I am present at pickup.</span>
            </label>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Pickup location</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">{trip.pickup_location || "Pickup location shared with the booking."}</p>
            <label className="flex items-start gap-2">
              <Checkbox checked={pickupConfirmed} onCheckedChange={(value) => setPickupConfirmed(Boolean(value))} />
              <span>I am at the agreed pickup location with the vehicle.</span>
            </label>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <PhotoStep
          title="Exterior evidence"
          hint="Minimum 4 photos. Capture front, rear, driver side and passenger side clearly."
          files={exteriorFiles}
          minimum={MIN_EXTERIOR_PHOTOS}
          onChange={(incoming) => setExteriorFiles((current) => addFiles(current, incoming))}
        />
      )}

      {step === 3 && (
        <PhotoStep
          title="Interior evidence"
          hint="Minimum 2 photos. Capture dashboard/odometer plus cabin or cargo area."
          files={interiorFiles}
          minimum={MIN_INTERIOR_PHOTOS}
          onChange={(incoming) => setInteriorFiles((current) => addFiles(current, incoming))}
        />
      )}

      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Pickup odometer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="odo">Current odometer (km)</Label>
            <Input id="odo" type="number" min={0} max={10000000} inputMode="decimal" value={odometer} onChange={(event) => setOdometer(event.target.value)} placeholder="e.g. 45230" />
          </CardContent>
        </Card>
      )}

      {step === 5 && (
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

      {step === 6 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Tracking consent</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Vehicle telematics may be used only during the active rental window for safety, recovery and trip operations. The active tracking session ends at check-out.
            </p>
            <label className="flex items-start gap-2">
              <Checkbox checked={trackingConsent} onCheckedChange={(value) => setTrackingConsent(Boolean(value))} />
              <span>I consent to active-trip vehicle tracking.</span>
            </label>
          </CardContent>
        </Card>
      )}

      {step === 7 && (
        <Card>
          <CardHeader><CardTitle>Seal pickup record & start trip</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              The condition record is written as immutable evidence when the trip starts.
            </p>
            <ul className="space-y-1">
              <li>Odometer: <b>{odometer || "—"} km</b></li>
              <li>Fuel / battery: <b>{fuelLevel || "—"}</b></li>
              <li>Exterior evidence: <b>{exteriorFiles.length} photos</b></li>
              <li>Interior evidence: <b>{interiorFiles.length} photos</b></li>
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
            {submitting ? "Sealing evidence…" : "Seal record & start trip"}
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
