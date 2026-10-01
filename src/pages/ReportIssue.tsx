import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const TYPES = [
  { value: "damage", label: "Vehicle damage" },
  { value: "accident", label: "Accident / collision" },
  { value: "mechanical", label: "Mechanical issue" },
  { value: "safety", label: "Safety concern" },
  { value: "late_return", label: "Late return" },
  { value: "fuel", label: "Fuel / charging issue" },
  { value: "cleaning", label: "Cleaning issue" },
  { value: "lost_item", label: "Lost item" },
  { value: "other", label: "Other" },
] as const;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 20;
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

export default function ReportIssue() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("damage");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tripExists, setTripExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!tripId) return;
    void supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .maybeSingle()
      .then(({ data }) => setTripExists(Boolean(data)));
  }, [tripId]);

  if (tripExists === false) {
    return (
      <div className="container mx-auto max-w-xl py-8 text-center">
        <h1 className="text-xl font-bold">Trip not found</h1>
      </div>
    );
  }

  const addFiles = (incoming: File[]) => {
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
    setFiles((current) => [...current, ...accepted].slice(0, MAX_FILES));
  };

  const submit = async () => {
    const cleanDescription = description.trim();
    if (cleanDescription.length < 10) {
      toast({ title: "Add more detail", description: "Describe the issue in at least 10 characters.", variant: "destructive" });
      return;
    }
    if (!user || !tripId) return;

    setSubmitting(true);
    try {
      const paths: string[] = [];
      for (const file of files) {
        const path = `${tripId}/incidents/${crypto.randomUUID()}.${fileExtension(file)}`;
        const { error } = await supabase.storage
          .from("rentauto-trip-photos")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (error) {
          throw new Error("A photo could not be uploaded. The incident was not submitted.");
        }
        paths.push(path);
      }

      const { data, error } = await supabase
        .from("trip_incidents")
        .insert({
          trip_id: tripId,
          reporter_user_id: user.id,
          type,
          description: cleanDescription,
          photo_urls: paths,
          status: "open",
        })
        .select("id,evidence_hash")
        .single();

      if (error || !data) throw new Error(error?.message || "Could not create incident.");

      toast({
        title: "Issue recorded",
        description: "Your evidence is sealed and the other trip participant has been notified.",
      });
      navigate(`/trips/${tripId}`);
    } catch (error) {
      toast({
        title: "Could not submit incident",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-xl space-y-4 py-6 pb-24">
      <Link to={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Report a trip issue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reports are attached to the booking with an evidence hash and audit trail. Photos remain private to the trip participants and the Rentauto review team.
          </p>

          <div className="space-y-1">
            <Label htmlFor="incident-type">Type</Label>
            <select
              id="incident-type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as (typeof TYPES)[number]["value"])}
            >
              {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="incident-description">Description</Label>
            <Textarea
              id="incident-description"
              rows={6}
              maxLength={4000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what happened, when you noticed it, and any immediate action taken."
            />
            <p className="text-xs text-muted-foreground">{description.trim().length}/4000 characters</p>
          </div>

          <div className="space-y-1">
            <Label>Photo evidence</Label>
            <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-6 hover:bg-muted/50">
              <Upload className="h-5 w-5" />
              <span className="text-sm">Take or add photos</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files || []));
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">{files.length}/{MAX_FILES} photos attached</p>
          </div>

          {(type === "accident" || type === "safety") ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              If anyone is in immediate danger, contact emergency services first. This report preserves the Rentauto record; it does not replace police, insurer, roadside or emergency reporting.
            </div>
          ) : null}

          <Button onClick={() => void submit()} disabled={submitting || description.trim().length < 10} className="w-full">
            {submitting ? "Sealing report…" : "Submit & seal report"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
