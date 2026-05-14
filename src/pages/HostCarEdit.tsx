import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { format } from "date-fns";

export default function HostCarEdit() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [car, setCar] = useState<any>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; sort_order: number }[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<{ id: string; start_at: string; end_at: string; type: string }[]>([]);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoading(true);
      const { data: c } = await supabase.from("cars").select("*").eq("id", id).maybeSingle();
      if (!c || c.host_id !== user.id) { toast({ title: "Not your vehicle", variant: "destructive" }); navigate("/host/cars"); return; }
      setCar(c);
      const [{ data: ps }, { data: ex }, { data: pol }, { data: cp }, { data: ab }] = await Promise.all([
        supabase.from("car_photos").select("id, url, sort_order").eq("car_id", id).order("sort_order"),
        supabase.from("car_extras").select("*").eq("car_id", id),
        supabase.from("cancellation_policies").select("*"),
        supabase.from("car_policies").select("cancellation_policy_id").eq("car_id", id).maybeSingle(),
        supabase.from("availability_blocks").select("id, start_at, end_at, type").eq("car_id", id).order("start_at"),
      ]);
      setPhotos(ps || []);
      setExtras(ex || []);
      setPolicies(pol || []);
      setSelectedPolicy(cp?.cancellation_policy_id ?? null);
      setBlocks(ab || []);
      setLoading(false);
    })();
  }, [id, user, navigate, toast]);

  const handleSaveBasics = async () => {
    if (!car) return;
    setSaving(true);
    const { error } = await supabase.from("cars").update({
      title: car.title,
      description: car.description,
      status: car.status,
      base_daily_price_cents: car.base_daily_price_cents,
      included_km_per_day: car.included_km_per_day,
      extra_km_price_cents: car.extra_km_price_cents,
      airport_pickup_enabled: car.airport_pickup_enabled,
      monthly_enabled: car.monthly_enabled,
      location_label: car.location_label,
      transmission: car.transmission,
      fuel_type: car.fuel_type,
      seats: car.seats,
      doors: car.doors,
    }).eq("id", car.id);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  };

  const handlePhotoUpload = async (file: File) => {
    if (!car) return;
    setUploading(true);
    const path = `${car.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("vehicle-photos").upload(path, file, { upsert: false });
    if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
    const { data, error } = await supabase.from("car_photos")
      .insert({ car_id: car.id, url: urlData.publicUrl, sort_order: photos.length })
      .select("id, url, sort_order").single();
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else if (data) setPhotos([...photos, data]);
    setUploading(false);
  };

  const handleDeletePhoto = async (photoId: string) => {
    const { error } = await supabase.from("car_photos").delete().eq("id", photoId);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else setPhotos(photos.filter((p) => p.id !== photoId));
  };

  const handleAddExtra = async () => {
    const { data, error } = await supabase.from("car_extras").insert({
      car_id: car.id, name: "New extra", price_cents: 1000, pricing_type: "per_trip", is_active: true,
    }).select("*").single();
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else if (data) setExtras([...extras, data]);
  };

  const handleSaveExtra = async (extra: any) => {
    const { error } = await supabase.from("car_extras").update({
      name: extra.name, description: extra.description, price_cents: extra.price_cents,
      pricing_type: extra.pricing_type, is_active: extra.is_active,
    }).eq("id", extra.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Extra saved" });
  };

  const handleDeleteExtra = async (extraId: string) => {
    const { error } = await supabase.from("car_extras").delete().eq("id", extraId);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else setExtras(extras.filter((e) => e.id !== extraId));
  };

  const handleSavePolicy = async () => {
    if (!selectedPolicy) return;
    await supabase.from("car_policies").delete().eq("car_id", car.id);
    const { error } = await supabase.from("car_policies")
      .insert({ car_id: car.id, cancellation_policy_id: selectedPolicy });
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Policy saved" });
  };

  const handleAddBlock = async () => {
    if (!blockStart || !blockEnd) return;
    const { data, error } = await supabase.from("availability_blocks")
      .insert({ car_id: car.id, start_at: new Date(blockStart).toISOString(), end_at: new Date(blockEnd).toISOString(), type: "blocked" })
      .select("id, start_at, end_at, type").single();
    if (error) toast({ title: "Block failed", description: error.message, variant: "destructive" });
    else if (data) { setBlocks([...blocks, data]); setBlockStart(""); setBlockEnd(""); }
  };

  const handleRemoveBlock = async (bId: string) => {
    const { error } = await supabase.from("availability_blocks").delete().eq("id", bId);
    if (error) toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    else setBlocks(blocks.filter((b) => b.id !== bId));
  };

  if (loading) return <div className="container py-8 max-w-3xl space-y-3"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!car) return null;

  return (
    <div className="container py-6 max-w-3xl pb-24 md:pb-8 space-y-6">
      <Link to="/host/cars" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to vehicles
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{car.year} {car.make} {car.model}</h1>
        <Badge variant={car.status === "active" ? "default" : "secondary"} className="capitalize">{car.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Listing details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Title"><Input value={car.title || ""} onChange={(e) => setCar({ ...car, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={3} value={car.description || ""} onChange={(e) => setCar({ ...car, description: e.target.value })} /></Field>
          <Field label="Location label"><Input value={car.location_label || ""} onChange={(e) => setCar({ ...car, location_label: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily price ($)">
              <Input type="number" value={car.base_daily_price_cents / 100}
                onChange={(e) => setCar({ ...car, base_daily_price_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} />
            </Field>
            <Field label="Status">
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={car.status} onChange={(e) => setCar({ ...car, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
            <Field label="Included km/day"><Input type="number" value={car.included_km_per_day} onChange={(e) => setCar({ ...car, included_km_per_day: parseInt(e.target.value || "0") })} /></Field>
            <Field label="Extra km rate (¢)"><Input type="number" value={car.extra_km_price_cents} onChange={(e) => setCar({ ...car, extra_km_price_cents: parseInt(e.target.value || "0") })} /></Field>
            <Field label="Seats"><Input type="number" value={car.seats} onChange={(e) => setCar({ ...car, seats: parseInt(e.target.value || "0") })} /></Field>
            <Field label="Doors"><Input type="number" value={car.doors} onChange={(e) => setCar({ ...car, doors: parseInt(e.target.value || "0") })} /></Field>
          </div>
          <div className="flex items-center justify-between">
            <Label>Airport pickup</Label>
            <Switch checked={!!car.airport_pickup_enabled} onCheckedChange={(v) => setCar({ ...car, airport_pickup_enabled: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Monthly rentals</Label>
            <Switch checked={!!car.monthly_enabled} onCheckedChange={(v) => setCar({ ...car, monthly_enabled: v })} />
          </div>
          <Button onClick={handleSaveBasics} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                <SafeImage src={p.url} className="aspect-square rounded-md" />
                <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleDeletePhoto(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <label className="inline-flex">
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.currentTarget.value = ""; }} />
            <span>
              <Button asChild variant="outline" disabled={uploading}>
                <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Add photo</span>
              </Button>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Extras</CardTitle>
          <Button size="sm" variant="outline" onClick={handleAddExtra}><Plus className="h-4 w-4" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {extras.length === 0 && <p className="text-sm text-muted-foreground">No extras added.</p>}
          {extras.map((ex, i) => (
            <div key={ex.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={ex.name} onChange={(e) => { const n = [...extras]; n[i] = { ...ex, name: e.target.value }; setExtras(n); }} />
                <Input type="number" placeholder="Price ¢" value={ex.price_cents} onChange={(e) => { const n = [...extras]; n[i] = { ...ex, price_cents: parseInt(e.target.value || "0") }; setExtras(n); }} />
              </div>
              <Textarea rows={2} placeholder="Description" value={ex.description || ""} onChange={(e) => { const n = [...extras]; n[i] = { ...ex, description: e.target.value }; setExtras(n); }} />
              <div className="flex items-center justify-between">
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={ex.pricing_type}
                  onChange={(e) => { const n = [...extras]; n[i] = { ...ex, pricing_type: e.target.value }; setExtras(n); }}>
                  <option value="per_trip">Per trip</option>
                  <option value="per_day">Per day</option>
                </select>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleSaveExtra(extras[i])}>Save</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteExtra(ex.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cancellation policy</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedPolicy || ""} onChange={(e) => setSelectedPolicy(e.target.value || null)}>
            <option value="">Select a policy…</option>
            {policies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button onClick={handleSavePolicy} disabled={!selectedPolicy}>Save policy</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Availability blocks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} />
            <Input type="datetime-local" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} />
          </div>
          <Button onClick={handleAddBlock} disabled={!blockStart || !blockEnd}><Plus className="h-4 w-4" />Block dates</Button>
          <div className="space-y-2">
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <span>{format(new Date(b.start_at), "MMM d, h:mma")} → {format(new Date(b.end_at), "MMM d, h:mma")} <Badge variant="outline" className="ml-2 capitalize">{b.type}</Badge></span>
                {b.type !== "booking_self" && (
                  <Button size="icon" variant="ghost" onClick={() => handleRemoveBlock(b.id)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
