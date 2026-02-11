import { Gauge } from "lucide-react";

interface Props {
  includedKm: number;
  extraKmPriceCents: number;
}

export function KilometersIncludedCard({ includedKm, extraKmPriceCents }: Props) {
  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Kilometers included</h2>
      <div className="flex items-start gap-3">
        <Gauge className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">{includedKm.toLocaleString()} KM</p>
          <p className="text-muted-foreground text-sm">
            ${(extraKmPriceCents / 100).toFixed(2)} charge for each additional kilometer
          </p>
        </div>
      </div>
    </div>
  );
}
