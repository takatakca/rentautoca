import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const categories = [
  "economy",
  "sedan",
  "suv",
  "luxury",
  "electric",
  "minivan",
  "truck",
  "other",
];

export default function HostCarNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    location: "",
    dailyPrice: "75",
    category: "sedan",
    description: "",
  });

  const validation = useMemo(() => {
    const messages: string[] = [];
    const currentYear = new Date().getFullYear() + 1;
    const price = Number(form.dailyPrice);

    if (!form.title.trim()) messages.push("Listing title is required.");
    if (!form.make.trim()) messages.push("Make is required.");
    if (!form.model.trim()) messages.push("Model is required.");
    if (form.year < 1980 || form.year > currentYear) messages.push("Enter a valid vehicle year.");
    if (!form.location.trim()) messages.push("City or pickup area is required.");
    if (!Number.isFinite(price) || price <= 0) messages.push("Daily price must be greater than $0.");

    return messages;
  }, [form]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || validation.length > 0) return;

    setSubmitting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("cars")
      .insert({
        host_id: user.id,
        status: "draft",
        title: form.title.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year,
        description: form.description.trim() || null,
        location_label: form.location.trim(),
        category: form.category,
        base_daily_price_cents: Math.round(Number(form.dailyPrice) * 100),
        currency: "CAD",
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "The vehicle draft could not be created.");
      return;
    }

    toast({
      title: "Vehicle draft created",
      description: "Add photos, documents, availability, and your cancellation policy before publishing.",
    });
    navigate(`/host/cars/${data.id}/edit`);
  };

  return (
    <div className="container max-w-3xl py-8 pb-24">
      <Link
        to="/host/cars"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to vehicles
      </Link>

      <div className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <Car className="h-4 w-4" aria-hidden="true" />
          New vehicle
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Create a vehicle draft</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Start with the essentials. The listing stays private until every required host,
          vehicle, document, payout, photo, and policy check is complete.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle basics</CardTitle>
          <CardDescription>
            You can add detailed features, photos, rules, documents, and availability after the draft is created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="title">Listing title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Clean Honda Civic near downtown Montréal"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={form.make}
                  onChange={(event) => setForm({ ...form, make: event.target.value })}
                  placeholder="Honda"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                  placeholder="Civic"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  min={1980}
                  max={new Date().getFullYear() + 1}
                  value={form.year}
                  onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">Pickup area</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="Montréal, QC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Daily price (CAD)</Label>
                <Input
                  id="price"
                  type="number"
                  min="1"
                  step="1"
                  value={form.dailyPrice}
                  onChange={(event) => setForm({ ...form, dailyPrice: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Short description</Label>
              <Textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Describe the vehicle, pickup experience, and anything guests should know."
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {validation.length > 0 ? (
              <p className="text-sm text-muted-foreground">{validation[0]}</p>
            ) : null}

            <Button type="submit" size="lg" disabled={submitting || validation.length > 0}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Create draft
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
