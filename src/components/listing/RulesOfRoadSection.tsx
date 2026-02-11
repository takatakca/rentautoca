import { Ban, Sparkles, Fuel, Mountain } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Rules {
  no_smoking?: boolean;
  keep_tidy?: boolean;
  refuel?: boolean;
  no_offroad?: boolean;
  smoking_fee_cents?: number;
  tidy_fee_cents?: number;
  telematics_disclosure?: string;
}

interface Props {
  rules: Rules;
}

export function RulesOfRoadSection({ rules }: Props) {
  const items = [
    {
      icon: Ban,
      title: "No smoking allowed",
      desc: rules.smoking_fee_cents
        ? `Smoking in any RENTAUTO vehicle would result in a $${(rules.smoking_fee_cents / 100).toFixed(0)} fee`
        : undefined,
      show: rules.no_smoking,
    },
    {
      icon: Sparkles,
      title: "Keep the vehicle tidy",
      desc: rules.tidy_fee_cents
        ? `Unreasonably dirty vehicles may result in a $${(rules.tidy_fee_cents / 100).toFixed(0)} fee`
        : undefined,
      show: rules.keep_tidy,
    },
    {
      icon: Fuel,
      title: "Refuel the vehicle",
      desc: "Missing fuel may result in an additional fee",
      show: rules.refuel,
    },
    {
      icon: Mountain,
      title: "No off-roading",
      desc: undefined,
      show: rules.no_offroad,
    },
  ];

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Rules of the road</h2>
      <div className="space-y-4">
        {items
          .filter((i) => i.show)
          .map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <item.icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{item.title}</p>
                {item.desc && <p className="text-muted-foreground text-sm">{item.desc}</p>}
              </div>
            </div>
          ))}
      </div>

      {rules.telematics_disclosure && (
        <>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">{rules.telematics_disclosure}</p>
        </>
      )}

      <button className="mt-6 text-primary font-semibold text-sm">Report listing</button>
    </div>
  );
}
