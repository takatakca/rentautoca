import { CheckCircle, Lock } from "lucide-react";
import type { CompletionSection } from "@/hooks/use-host-completion";

interface CompletionProgressProps {
  percentage: number;
  canPublish: boolean;
  canAcceptBookings: boolean;
  sections: CompletionSection[];
}

export function CompletionProgress({ percentage, canPublish, canAcceptBookings, sections }: CompletionProgressProps) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const incompleteRequired = sections.filter((s) => s.required && !s.complete);

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      {/* Circular progress */}
      <div className="relative">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} strokeWidth="8" fill="none" className="stroke-muted" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            strokeWidth="8"
            fill="none"
            className="stroke-primary transition-all duration-700 ease-out"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{percentage}%</span>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Host Profile Setup</h2>
        {incompleteRequired.length > 0 ? (
          <p className="text-muted-foreground text-sm">
            Complete {incompleteRequired.length} more required{" "}
            {incompleteRequired.length === 1 ? "section" : "sections"} to unlock all features
          </p>
        ) : (
          <p className="text-sm text-success font-medium">All required sections complete!</p>
        )}
      </div>

      {/* Feature gates */}
      <div className="flex gap-6 text-sm">
        <div className={`flex items-center gap-1.5 ${canPublish ? "text-success" : "text-muted-foreground"}`}>
          {canPublish ? <CheckCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          <span>Publish Listings</span>
        </div>
        <div className={`flex items-center gap-1.5 ${canAcceptBookings ? "text-success" : "text-muted-foreground"}`}>
          {canAcceptBookings ? <CheckCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          <span>Accept Bookings</span>
        </div>
      </div>
    </div>
  );
}
