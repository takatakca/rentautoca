import { Button } from "@/components/ui/button";

interface Props {
  originalCents: number;
  totalCents: number;
  disabled?: boolean;
}

export function StickyCheckoutBar({ originalCents, totalCents, disabled }: Props) {
  const hasDiscount = originalCents > totalCents;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border px-4 py-3 flex items-center justify-between">
      <div>
        {hasDiscount && (
          <span className="text-muted-foreground line-through text-sm mr-2">
            ${(originalCents / 100).toFixed(0)}
          </span>
        )}
        <span className="text-lg font-bold">${(totalCents / 100).toFixed(0)} total</span>
        <p className="text-xs text-muted-foreground">Before taxes</p>
      </div>
      <Button size="lg" className="px-8 rounded-xl" disabled={disabled}>
        Continue
      </Button>
    </div>
  );
}
