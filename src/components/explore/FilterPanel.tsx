import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ExploreFilters, VEHICLE_TYPES, VehicleType } from "./filter-state";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function Option({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-2 text-sm transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function FilterPanel({
  value,
  onChange,
}: {
  value: ExploreFilters;
  onChange: (next: ExploreFilters) => void;
}) {
  const set = <K extends keyof ExploreFilters>(key: K, v: ExploreFilters[K]) => onChange({ ...value, [key]: v });
  const toggleType = (t: VehicleType) =>
    set("types", value.types.includes(t) ? value.types.filter((x) => x !== t) : [...value.types, t]);

  return (
    <div className="pb-2">
      <Group title="Price per day">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label htmlFor="minPrice" className="text-xs text-muted-foreground">
              Min
            </Label>
            <Input
              id="minPrice"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="$0"
              value={value.minPrice ?? ""}
              onChange={(e) => set("minPrice", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="maxPrice" className="text-xs text-muted-foreground">
              Max
            </Label>
            <Input
              id="maxPrice"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Any"
              value={value.maxPrice ?? ""}
              onChange={(e) => set("maxPrice", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        </div>
      </Group>

      <Group title="Vehicle type">
        <div className="flex flex-wrap gap-2">
          {VEHICLE_TYPES.map((t) => (
            <Option key={t} active={value.types.includes(t)} onClick={() => toggleType(t)}>
              {t}
            </Option>
          ))}
        </div>
      </Group>

      <Group title="Seats">
        <div className="flex flex-wrap gap-2">
          {[2, 4, 5, 7].map((s) => (
            <Option key={s} active={value.seats === s} onClick={() => set("seats", value.seats === s ? null : s)}>
              {s}+
            </Option>
          ))}
        </div>
      </Group>

      <Group title="Transmission">
        <div className="flex flex-wrap gap-2">
          {(["automatic", "manual"] as const).map((t) => (
            <Option
              key={t}
              active={value.transmission === t}
              onClick={() => set("transmission", value.transmission === t ? null : t)}
            >
              {t === "automatic" ? "Automatic" : "Manual"}
            </Option>
          ))}
        </div>
      </Group>

      <Group title="Fuel">
        <div className="flex flex-wrap gap-2">
          {(["gas", "hybrid", "electric"] as const).map((f) => (
            <Option key={f} active={value.fuel === f} onClick={() => set("fuel", value.fuel === f ? null : f)}>
              {f === "gas" ? "Gas" : f === "hybrid" ? "Hybrid" : "Electric"}
            </Option>
          ))}
        </div>
      </Group>

      <Group title="Trip options">
        <Toggle id="f-airport" label="Airport pickup" checked={value.airport} onChange={(v) => set("airport", v)} />
        <Toggle id="f-monthly" label="Monthly rental" checked={value.monthly} onChange={(v) => set("monthly", v)} />
        <Toggle id="f-instant" label="Instant booking" checked={value.instant} onChange={(v) => set("instant", v)} />
      </Group>

      <Group title="Host rating">
        <div className="flex flex-wrap gap-2">
          {[4, 4.5, 4.8].map((r) => (
            <Option key={r} active={value.minRating === r} onClick={() => set("minRating", value.minRating === r ? null : r)}>
              {r}+
            </Option>
          ))}
        </div>
      </Group>
    </div>
  );
}
