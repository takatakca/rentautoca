import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LocationFormProps {
  data: Record<string, any> | null;
  onSaved: () => Promise<void>;
}

export function LocationForm({ data, onSaved }: LocationFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [provinces, setProvinces] = useState<{ code: string; name: string }[]>([]);
  const [form, setForm] = useState({
    city: data?.city || "",
    province: data?.province || "",
    postal_code: data?.postal_code || "",
  });

  useEffect(() => {
    supabase
      .from("provinces")
      .select("code, name")
      .eq("is_supported", true)
      .order("sort_order")
      .then(({ data: prov }) => {
        if (prov) setProvinces(prov);
      });
  }, []);

  const handleSave = async () => {
    if (!user) return;

    const postalRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
    if (form.postal_code && !postalRegex.test(form.postal_code)) {
      toast({ title: "Invalid postal code", description: "Use Canadian format: A1A 1A1", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        city: form.city || null,
        province: form.province || null,
        postal_code: form.postal_code?.toUpperCase() || null,
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Location updated successfully." });
      await onSaved();
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          placeholder="e.g., Montreal"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="province">Province</Label>
        <Select value={form.province} onValueChange={(v) => setForm((f) => ({ ...f, province: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Select province" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="postalCode">Postal Code</Label>
        <Input
          id="postalCode"
          value={form.postal_code}
          onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value.toUpperCase() }))}
          placeholder="A1A 1A1"
          maxLength={7}
        />
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save Location
      </Button>
    </div>
  );
}
