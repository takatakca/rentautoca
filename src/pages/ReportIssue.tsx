import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload } from "lucide-react";

const TYPES = [
  { value: "damage", label: "Damage" },
  { value: "accident", label: "Accident" },
  { value: "late_return", label: "Late return" },
  { value: "fuel", label: "Fuel issue" },
  { value: "cleaning", label: "Cleaning issue" },
  { value: "lost_item", label: "Lost item" },
  { value: "other", label: "Other" },
];

export default function ReportIssue() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [type, setType] = useState("damage");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [tripExists, setTripExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!tripId) return;
    supabase.from("trips").select("id").eq("id", tripId).maybeSingle().then(({ data }) => setTripExists(!!data));
  }, [tripId]);

  if (tripExists === false) {
    return <div className="container py-8 max-w-xl mx-auto text-center"><h1 className="text-xl font-bold">Trip not found</h1></div>;
  }

  const submit = async () => {
    if (!description.trim()) { toast({ title: "Please describe the issue", variant: "destructive" }); return; }
    if (!user) return;
    setSubmitting(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = `${tripId}/incidents/${Date.now()}-${i}.${f.name.split(".").pop() || "jpg"}`;
        const { error } = await supabase.storage.from("trip-photos").upload(path, f);
        if (!error) urls.push(path);
      }
      const { error } = await supabase.from("trip_incidents").insert({
        trip_id: tripId!, reporter_user_id: user.id, type, description, photo_urls: urls, status: "open",
      });
      if (error) throw error;
      toast({ title: "Issue reported", description: "Our team will review and follow up." });
      navigate(`/trips/${tripId}`);
    } catch (e) {
      toast({ title: "Could not submit", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-6 max-w-xl mx-auto pb-24 space-y-4">
      <Link to={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <Card>
        <CardHeader><CardTitle>Report an issue</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Type</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened?" />
          </div>
          <div>
            <Label>Photos (optional)</Label>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 cursor-pointer hover:bg-muted/50 mt-1">
              <Upload className="h-5 w-5" /><span className="text-sm">Add photos</span>
              <input type="file" multiple accept="image/*" className="hidden"
                onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])])} />
            </label>
            {files.length > 0 && <p className="text-xs text-muted-foreground mt-2">{files.length} photo(s) attached</p>}
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
