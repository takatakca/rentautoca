import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please check your connection and try again.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center text-center px-6 py-12 rounded-2xl border border-destructive/20 bg-destructive/5",
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="font-semibold text-base">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
          <RotateCcw className="h-4 w-4 mr-2" /> Try again
        </Button>
      )}
    </div>
  );
}
