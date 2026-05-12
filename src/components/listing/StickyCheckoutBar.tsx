import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  originalCents: number;
  totalCents: number;
  disabled?: boolean;
  loading?: boolean;
  ctaLabel?: string;
  onReserve?: () => void;
}

export function StickyCheckoutBar({
  originalCents,
  totalCents,
  disabled,
  loading,
  ctaLabel = "Continue",
  onReserve,
}: Props) {
  const hasDiscount = originalCents > totalCents;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border px-4 py-3 flex items-center justify-between">
      <div>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Calculating…</span>
          </div>
        ) : (
          <>
            {hasDiscount && (
              <span className="text-muted-foreground line-through text-sm mr-2">
                ${(originalCents / 100).toFixed(0)}
              </span>
            )}
            <span className="text-lg font-bold">${(totalCents / 100).toFixed(0)} total</span>
            <p className="text-xs text-muted-foreground">Before taxes</p>
          </>
        )}
      </div>
      <Button
        size="lg"
        className="px-8 rounded-xl"
        disabled={disabled || loading}
        onClick={onReserve}
      >
        {ctaLabel}
      </Button>
    </div>
  );
}
