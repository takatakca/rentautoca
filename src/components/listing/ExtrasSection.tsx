import { Info } from "lucide-react";

interface Extra {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  pricing_type: string;
  is_active: boolean;
}

interface Props {
  extras: Extra[];
}

export function ExtrasSection({ extras }: Props) {
  if (extras.length === 0) return null;

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-1">Extras ({extras.length})</h2>
      <div className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
        <span>Add optional Extras to your trip at checkout.</span>
        <Info className="h-4 w-4" />
      </div>

      <div className="space-y-4">
        {extras.map((extra) => (
          <div key={extra.id}>
            <p className="font-bold">{extra.name}</p>
            {extra.description && (
              <p className="text-sm text-muted-foreground mt-1">{extra.description}</p>
            )}
            <p className="text-sm font-semibold mt-1">
              ${(extra.price_cents / 100).toFixed(2)}{" "}
              <span className="text-muted-foreground font-normal">
                / {extra.pricing_type === "per_day" ? "day" : "trip"}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
