import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { SafeImage } from "@/components/ui/safe-image";
import { DetailPageSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Plus,
  Radio,
  Trash2,
  Upload,
} from "lucide-react";
import { format } from "date-fns";

type CarRow = any;
type Photo = { id: string; url: string; sort_order: number };
type Extra = any;
type Policy = { id: string; name: string };
type Block = { id: string; start_at: string; end_at: string; type: string };
type Device = {
  id: string;
  provider: string;
  device_identifier: string;
  status: string;
  last_seen_at: string | null;
};

export default function HostCarEdit() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  const [car, setCar] = useState<CarRow | null>(null);
  const [initialCar, setInitialCar] = useState<CarRow | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!id || !user) return;
    setLoading(true);
    setLoadError(null);
    setUnauthorized(false);
    try {
      const { data: c, error } = await supabase.from("cars").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!c) {
        setLoadError("Vehicle not found.");
        setLoading(false);
        return;
      }
      if (c.host_id !== user.id) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      setCar(c);
      setInitialCar(c);
      const [{ data: ps }, { data: ex }, { data: pol }, { data: cp }, { data: ab }, { data: dev }] =
        await Promise.all([
          supabase.from("car_photos").select("id, url, sort_order").eq("car_id", id).order("sort_order"),
          supabase.from("car_extras").select("*").eq("car_id", id),
          supabase.from("cancellation_policies").select("id, name"),
          supabase.from("car_policies").select("cancellation_policy_id").eq("car_id", id).maybeSingle(),
          supabase
            .from("availability_blocks")
            .select("id, start_at, end_at, type")
            .eq("car_id", id)
            .order("start_at"),
          supabase
            .from("vehicle_tracking_devices")
            .select("id, provider, device_identifier, status, last_seen_at")
            .eq("car_id", id)
            .maybeSingle(),
        ]);
      setPhotos((ps as Photo[]) || []);
      setExtras(ex || []);
      setPolicies((pol as Policy[]) || []);
      setSelectedPolicy(cp?.cancellation_policy_id ?? null);
      setBlocks((ab as Block[]) || []);
      setDevice((dev as Device) || null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load vehicle.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const isDirty = useMemo(() => {
    if (!car || !initialCar) return false;
    const keys = [
      "title",
      "description",
      "status",
      "base_daily_price_cents",
      "included_km_per_day",
      "extra_km_price_cents",
      "airport_pickup_enabled",
      "monthly_enabled",
      "location_label",
      "transmission",
      "fuel_type",
      "seats",
      "doors",
    ];
    return keys.some((k) => car[k] !== initialCar[k]);
  }, [car, initialCar]);

  // Warn on navigation away with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const validationErrors = useMemo(() => {
    if (!car) return [] as string[];
    const errs: string[] = [];
    if (!car.title?.trim()) errs.push("Title is required");
    if (!car.make?.trim()) errs.push("Make is required");
    if (!car.model?.trim()) errs.push("Model is required");
    if (!car.year || car.year < 1980) errs.push("Year is required");
    if (!car.base_daily_price_cents || car.base_daily_price_cents <= 0) errs.push("Daily price must be greater than 0");
    if ((car.included_km_per_day ?? 0) < 0) errs.push("Included km must be 0 or more");
    if ((car.extra_km_price_cents ?? 0) < 0) errs.push("Extra km fee must be 0 or more");
    return errs;
  }, [car]);

  const handleSaveBasics = async () => {
    if (!car || validationErrors.length) return;
    setSaving(true);
    setSaveState("idle");
    const { error } = await supabase
      .from("cars")
      .update({
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
      })
      .eq("id", car.id);
    setSaving(false);
    if (error) {
      setSaveState("error");
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setSaveState("saved");
      setInitialCar(car);
      toast({ title: "Changes saved" });
      setTimeout(() => setSaveState("idle"), 2500);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!car) return;
    setUploading(true);
    const path = `${car.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("vehicle-photos").upload(path, file, { upsert: false });
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
    const { data, error } = await supabase
      .from("car_photos")
      .insert({ car_id: car.id, url: urlData.publicUrl, sort_order: photos.length })
      .select("id, url, sort_order")
      .single();
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else if (data) setPhotos([...photos, data as Photo]);
    setUploading(false);
  };

  const handleDeletePhoto = async (photoId: string) => {
    const { error } = await supabase.from("car_photos").delete().eq("id", photoId);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else setPhotos(photos.filter((p) => p.id !== photoId));
  };

  const handleAddExtra = async () => {
    const { data, error } = await supabase
      .from("car_extras")
      .insert({ car_id: car.id, name: "New extra", price_cents: 1000, pricing_type: "per_trip", is_active: true })
      .select("*")
      .single();
    if (error) toast({ title: "Add failed", description: error.message, variant: "destructive" });
    else if (data) setExtras([...extras, data]);
  };

  const handleSaveExtra = async (extra: Extra) => {
    const { error } = await supabase
      .from("car_extras")
      .update({
        name: extra.name,
        description: extra.description,
        price_cents: extra.price_cents,
        pricing_type: extra.pricing_type,
        is_active: extra.is_active,
      })
      .eq("id", extra.id);
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
    const { error } = await supabase
      .from("car_policies")
      .insert({ car_id: car.id, cancellation_policy_id: selectedPolicy });
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Policy saved" });
  };

  const handleAddBlock = async () => {
    if (!blockStart || !blockEnd) return;
    const { data, error } = await supabase
      .from("availability_blocks")
      .insert({
        car_id: car.id,
        start_at: new Date(blockStart).toISOString(),
        end_at: new Date(blockEnd).toISOString(),
        type: "blocked",
      })
      .select("id, start_at, end_at, type")
      .single();
    if (error) toast({ title: "Block failed", description: error.message, variant: "destructive" });
    else if (data) {
      setBlocks([...blocks, data as Block]);
      setBlockStart("");
      setBlockEnd("");
    }
  };

  const handleRemoveBlock = async (bId: string) => {
    const { error } = await supabase.from("availability_blocks").delete().eq("id", bId);
    if (error) toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    else setBlocks(blocks.filter((b) => b.id !== bId));
  };

  if (loading) return <DetailPageSkeleton />;
  if (unauthorized)
    return (
      <div className="container max-w-2xl py-10">
        <ErrorState
          title="Not your vehicle"
          description="You don't have permission to edit this listing."
          onRetry={() => navigate("/host/cars")}
        />
      </div>
    );
  if (loadError || !car)
    return (
      <div className="container max-w-2xl py-10">
        <ErrorState
          title="Vehicle unavailable"
          description={loadError ?? "We couldn't find this vehicle."}
          onRetry={load}
        />
      </div>
    );

  const canSave = !saving && validationErrors.length === 0 && isDirty;
  const saveLabel = saving
    ? "Saving…"
    : saveState === "saved"
    ? "Saved"
    : saveState === "error"
    ? "Retry save"
    : "Save changes";

  return (
    <div className="container py-6 max-w-3xl pb-[max(6rem,env(safe-area-inset-bottom))] md:pb-10 space-y-6 min-h-dvh">
      <Link
        to="/host/cars"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to vehicles
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">
            {car.year} {car.make} {car.model}
          </h1>
          <p className="text-sm text-muted-foreground">Manage listing details, pricing, and availability.</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-500">
              Unsaved changes
            </Badge>
          )}
          <Badge variant={car.status === "active" ? "default" : "secondary"} className="capitalize">
            {car.status}
          </Badge>
        </div>
      </header>

      {/* Basic vehicle info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
          <CardDescription>Title, description, and where the vehicle is based.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Listing title" htmlFor="title" hint="Shown at the top of your listing.">
            <Input
              id="title"
              value={car.title || ""}
              onChange={(e) => setCar({ ...car, title: e.target.value })}
              required
              aria-required="true"
            />
          </Field>
          <Field label="Description" htmlFor="description" hint="Highlight what makes this vehicle special.">
            <Textarea
              id="description"
              rows={3}
              value={car.description || ""}
              onChange={(e) => setCar({ ...car, description: e.target.value })}
            />
          </Field>
          <Field label="Location label" htmlFor="loc" hint="Neighbourhood or city shown to guests.">
            <Input
              id="loc"
              value={car.location_label || ""}
              onChange={(e) => setCar({ ...car, location_label: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Seats" htmlFor="seats">
              <Input
                id="seats"
                type="number"
                min={1}
                value={car.seats ?? 0}
                onChange={(e) => setCar({ ...car, seats: parseInt(e.target.value || "0") })}
              />
            </Field>
            <Field label="Doors" htmlFor="doors">
              <Input
                id="doors"
                type="number"
                min={1}
                value={car.doors ?? 0}
                onChange={(e) => setCar({ ...car, doors: parseInt(e.target.value || "0") })}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Daily rate and mileage charges.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily price (CAD)" htmlFor="price" hint="Must be greater than $0.">
              <Input
                id="price"
                type="number"
                min={1}
                step="0.01"
                value={(car.base_daily_price_cents ?? 0) / 100}
                onChange={(e) =>
                  setCar({
                    ...car,
                    base_daily_price_cents: Math.round(parseFloat(e.target.value || "0") * 100),
                  })
                }
                required
              />
            </Field>
            <Field label="Listing status" htmlFor="status">
              <select
                id="status"
                aria-label="Listing status"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={car.status}
                onChange={(e) => setCar({ ...car, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
            <Field label="Included km / day" htmlFor="ikm" hint="Free kilometres per rental day.">
              <Input
                id="ikm"
                type="number"
                min={0}
                value={car.included_km_per_day ?? 0}
                onChange={(e) => setCar({ ...car, included_km_per_day: parseInt(e.target.value || "0") })}
              />
            </Field>
            <Field label="Extra km fee (¢)" htmlFor="ekm" hint="Charged per km over the included amount.">
              <Input
                id="ekm"
                type="number"
                min={0}
                value={car.extra_km_price_cents ?? 0}
                onChange={(e) => setCar({ ...car, extra_km_price_cents: parseInt(e.target.value || "0") })}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Pickup & delivery */}
      <Card>
        <CardHeader>
          <CardTitle>Pickup & delivery</CardTitle>
          <CardDescription>How guests can collect the vehicle.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="airport">Airport pickup</Label>
              <p className="text-xs text-muted-foreground">Allow delivery or pickup at the airport.</p>
            </div>
            <Switch
              id="airport"
              checked={!!car.airport_pickup_enabled}
              onCheckedChange={(v) => setCar({ ...car, airport_pickup_enabled: v })}
              aria-label="Airport pickup"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="monthly">Monthly rentals</Label>
              <p className="text-xs text-muted-foreground">Accept long-term bookings with monthly pricing.</p>
            </div>
            <Switch
              id="monthly"
              checked={!!car.monthly_enabled}
              onCheckedChange={(v) => setCar({ ...car, monthly_enabled: v })}
              aria-label="Monthly rentals"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4" aria-hidden="true" /> Tracking device
          </CardTitle>
          <CardDescription>
            GPS data is only collected while a trip is active. Guests are notified before booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {device ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={device.status === "active" ? "default" : "secondary"} className="capitalize">
                  {device.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Provider</span>
                <span className="capitalize">{device.provider}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last seen</span>
                <span>{device.last_seen_at ? format(new Date(device.last_seen_at), "PP p") : "Never"}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No tracking device installed. Tracking is optional but recommended for security and recovery.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>The first photo is used as the cover image.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {photos.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No photos yet"
              description="Upload at least one photo so guests can preview the vehicle."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((p, idx) => (
                <div key={p.id} className="relative">
                  <SafeImage src={p.url} alt="" className="aspect-square rounded-md" />
                  {idx === 0 && (
                    <Badge className="absolute top-1 left-1 text-[10px]" variant="secondary">
                      Cover
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 h-7 w-7"
                    aria-label="Delete photo"
                    onClick={() => handleDeletePhoto(p.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <label className="inline-flex">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Upload vehicle photo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhotoUpload(f);
                e.currentTarget.value = "";
              }}
            />
            <span>
              <Button asChild variant="outline" disabled={uploading}>
                <span>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden="true" />
                  )}{" "}
                  Add photo
                </span>
              </Button>
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Extras */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Extras</CardTitle>
            <CardDescription>Optional add-ons offered with this vehicle.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleAddExtra} aria-label="Add extra">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {extras.length === 0 && <p className="text-sm text-muted-foreground">No extras added.</p>}
          {extras.map((ex, i) => (
            <div key={ex.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label="Extra name"
                  placeholder="Name"
                  value={ex.name}
                  onChange={(e) => {
                    const n = [...extras];
                    n[i] = { ...ex, name: e.target.value };
                    setExtras(n);
                  }}
                />
                <Input
                  aria-label="Extra price in cents"
                  type="number"
                  placeholder="Price ¢"
                  value={ex.price_cents}
                  onChange={(e) => {
                    const n = [...extras];
                    n[i] = { ...ex, price_cents: parseInt(e.target.value || "0") };
                    setExtras(n);
                  }}
                />
              </div>
              <Textarea
                aria-label="Extra description"
                rows={2}
                placeholder="Description"
                value={ex.description || ""}
                onChange={(e) => {
                  const n = [...extras];
                  n[i] = { ...ex, description: e.target.value };
                  setExtras(n);
                }}
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                <select
                  aria-label="Pricing type"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={ex.pricing_type}
                  onChange={(e) => {
                    const n = [...extras];
                    n[i] = { ...ex, pricing_type: e.target.value };
                    setExtras(n);
                  }}
                >
                  <option value="per_trip">Per trip</option>
                  <option value="per_day">Per day</option>
                </select>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleSaveExtra(extras[i])}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    aria-label="Delete extra"
                    onClick={() => handleDeleteExtra(ex.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rules / cancellation */}
      <Card>
        <CardHeader>
          <CardTitle>Rules & cancellation policy</CardTitle>
          <CardDescription>Sets refund rules when guests cancel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Cancellation policy" htmlFor="policy">
            <select
              id="policy"
              aria-label="Cancellation policy"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedPolicy || ""}
              onChange={(e) => setSelectedPolicy(e.target.value || null)}
            >
              <option value="">Select a policy…</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Button onClick={handleSavePolicy} disabled={!selectedPolicy}>
            Save policy
          </Button>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader>
          <CardTitle>Availability blocks</CardTitle>
          <CardDescription>Mark dates when the vehicle isn't available for rental.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Block start" htmlFor="bstart">
              <Input
                id="bstart"
                type="datetime-local"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
              />
            </Field>
            <Field label="Block end" htmlFor="bend">
              <Input
                id="bend"
                type="datetime-local"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
              />
            </Field>
          </div>
          <Button onClick={handleAddBlock} disabled={!blockStart || !blockEnd}>
            <Plus className="h-4 w-4" /> Block dates
          </Button>
          <div className="space-y-2">
            {blocks.length === 0 && (
              <p className="text-sm text-muted-foreground">No availability blocks yet.</p>
            )}
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm border-b border-border pb-2 gap-2">
                <span className="min-w-0">
                  {format(new Date(b.start_at), "MMM d, h:mma")} →{" "}
                  {format(new Date(b.end_at), "MMM d, h:mma")}{" "}
                  <Badge variant="outline" className="ml-2 capitalize">
                    {b.type}
                  </Badge>
                </span>
                {b.type !== "booking_self" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove availability block"
                    onClick={() => handleRemoveBlock(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div
        className="sticky bottom-0 left-0 right-0 -mx-4 sm:mx-0 z-30 bg-background/95 backdrop-blur border-t border-border px-4 py-3 sm:rounded-xl sm:border sm:shadow-lg"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground min-h-[1rem]">
            {validationErrors.length > 0 ? (
              <span className="text-destructive">{validationErrors[0]}</span>
            ) : isDirty ? (
              "You have unsaved changes."
            ) : saveState === "saved" ? (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> All changes saved
              </span>
            ) : (
              "All changes saved."
            )}
          </div>
          <Button
            onClick={handleSaveBasics}
            disabled={!canSave}
            aria-label="Save listing changes"
            title={validationErrors[0] ?? (isDirty ? "Save changes" : "No changes to save")}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
