import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProtectionPlan {
  id: string;
  name: string;
  tier: string;
  description: string | null;
  coverage_details: { label: string; included: boolean }[];
  price_per_day_cents: number;
  deductible_cents: number;
}

interface Props {
  selectedPlanId: string | null;
  onSelect: (planId: string) => void;
  days?: number;
}

export function ProtectionPlanSelector({ selectedPlanId, onSelect, days = 1 }: Props) {
  const { data: plans } = useQuery({
    queryKey: ["protection-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protection_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as ProtectionPlan[];
    },
  });

  if (!plans || plans.length === 0) return null;

  const tierColors: Record<string, string> = {
    basic: "border-muted-foreground/30",
    standard: "border-primary",
    premium: "border-warning",
  };

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-1">Insurance & Protection</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Choose a protection plan for your trip
      </p>
      <div className="space-y-3">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const totalCents = plan.price_per_day_cents * days;
          return (
            <button
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className={cn(
                "w-full text-left rounded-xl border-2 p-4 transition-all",
                isSelected
                  ? `${tierColors[plan.tier] || "border-primary"} bg-card`
                  : "border-border bg-card/50 hover:border-muted-foreground/50"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className={cn("h-5 w-5", plan.tier === "premium" ? "text-warning" : "text-primary")} />
                  <span className="font-bold">{plan.name}</span>
                  {plan.tier === "standard" && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Recommended</span>
                  )}
                </div>
                <span className="font-semibold text-sm">
                  {plan.price_per_day_cents === 0
                    ? "Included"
                    : `$${(totalCents / 100).toFixed(0)}/trip`}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
              <div className="text-xs text-muted-foreground mb-2">
                Deductible: <span className="font-semibold text-foreground">${(plan.deductible_cents / 100).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {plan.coverage_details.map((item) => (
                  <div key={item.label} className="flex items-center gap-1 text-xs">
                    {item.included ? (
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    )}
                    <span className={item.included ? "text-foreground" : "text-muted-foreground/50"}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
