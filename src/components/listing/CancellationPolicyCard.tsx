import { ThumbsUp } from "lucide-react";

interface Props {
  policy: { name: string; summary: string } | null;
}

export function CancellationPolicyCard({ policy }: Props) {
  const name = policy?.name || "Free cancellation";
  const summary = policy?.summary || "Full refund within 24 hours of booking. More flexible options available at checkout.";

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold mb-4">Cancellation policy</h2>
      <div className="flex items-start gap-3">
        <ThumbsUp className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-muted-foreground text-sm">{summary}</p>
        </div>
      </div>
    </div>
  );
}
