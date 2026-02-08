import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreferencesFormProps {
  data: Record<string, any> | null;
  onSaved: () => Promise<void>;
  sectionFocus?: string;
}

export function PreferencesForm({ data, onSaved, sectionFocus }: PreferencesFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    min_trip_days: data?.min_trip_days ?? 1,
    max_trip_days: data?.max_trip_days ?? 30,
    advance_notice_hours: data?.advance_notice_hours ?? 24,
    buffer_hours: data?.buffer_hours ?? 4,
    delivery_available: data?.delivery_available ?? false,
    delivery_radius_km: data?.delivery_radius_km ?? null,
    delivery_fee_cents: data?.delivery_fee_cents ?? null,
    emergency_contact_name: data?.emergency_contact_name ?? "",
    emergency_contact_phone: data?.emergency_contact_phone ?? "",
  });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase.from("host_preferences").upsert(
      {
        user_id: user.id,
        min_trip_days: form.min_trip_days,
        max_trip_days: form.max_trip_days,
        advance_notice_hours: form.advance_notice_hours,
        buffer_hours: form.buffer_hours,
        delivery_available: form.delivery_available,
        delivery_radius_km: form.delivery_available ? form.delivery_radius_km : null,
        delivery_fee_cents: form.delivery_available ? form.delivery_fee_cents : null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Preferences updated successfully." });
      await onSaved();
    }
  };

  const showPreferences = sectionFocus === "preferences" || !sectionFocus;
  const showEmergency = sectionFocus === "emergency" || !sectionFocus;

  return (
    <div className="space-y-6">
      {showPreferences && (
        <div className="space-y-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trip Settings</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Trip (days)</Label>
              <Input
                type="number"
                min={1}
                value={form.min_trip_days}
                onChange={(e) => setForm((f) => ({ ...f, min_trip_days: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Trip (days)</Label>
              <Input
                type="number"
                min={1}
                value={form.max_trip_days}
                onChange={(e) => setForm((f) => ({ ...f, max_trip_days: parseInt(e.target.value) || 30 }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Advance Notice (hrs)</Label>
              <Input
                type="number"
                min={0}
                value={form.advance_notice_hours}
                onChange={(e) =>
                  setForm((f) => ({ ...f, advance_notice_hours: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Buffer Between Trips (hrs)</Label>
              <Input
                type="number"
                min={0}
                value={form.buffer_hours}
                onChange={(e) => setForm((f) => ({ ...f, buffer_hours: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <Label htmlFor="delivery" className="cursor-pointer">
              Offer vehicle delivery
            </Label>
            <Switch
              id="delivery"
              checked={form.delivery_available}
              onCheckedChange={(v) => setForm((f) => ({ ...f, delivery_available: v }))}
            />
          </div>

          {form.delivery_available && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delivery Radius (km)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.delivery_radius_km ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, delivery_radius_km: parseInt(e.target.value) || null }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery Fee ($ CAD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.delivery_fee_cents ? (form.delivery_fee_cents / 100).toFixed(2) : ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      delivery_fee_cents: Math.round(parseFloat(e.target.value) * 100) || null,
                    }))
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}

      {showEmergency && (
        <div className="space-y-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Emergency Contact
          </h4>
          <div className="space-y-2">
            <Label>Contact Name</Label>
            <Input
              value={form.emergency_contact_name}
              onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input
              type="tel"
              value={form.emergency_contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save {sectionFocus === "emergency" ? "Emergency Contact" : "Preferences"}
      </Button>
    </div>
  );
}
