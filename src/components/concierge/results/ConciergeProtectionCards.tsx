import { ShieldCheck, Check } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  tier?: string | null;
  description?: string | null;
  price_per_day_cents: number;
  deductible_cents: number;
  coverage_details?: unknown;
}

const m = (c: number) => `$${(c / 100).toFixed(0)}`;

export function ConciergeProtectionCards({ plans }: { plans: Plan[] }) {
  if (!plans?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Protection options
      </h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {plans.map((p) => (
          <article key={p.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              <h4 className="text-sm font-semibold">{p.name}</h4>
            </div>
            <p className="mt-1 text-lg font-bold">
              {m(p.price_per_day_cents)}
              <span className="text-xs font-normal text-muted-foreground">/day</span>
            </p>
            <p className="text-xs text-muted-foreground">{m(p.deductible_cents)} deductible</p>
            {p.description ? (
              <p className="mt-2 flex gap-1.5 text-xs leading-snug text-muted-foreground">
                <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                {p.description}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ConciergePolicyCards({
  policies,
}: {
  policies: { id: string; name: string; summary?: string | null }[];
}) {
  if (!policies?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Cancellation policies
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {policies.map((p) => (
          <article key={p.id} className="rounded-2xl border border-border bg-card p-3">
            <h4 className="text-sm font-semibold">{p.name}</h4>
            {p.summary ? (
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{p.summary}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
