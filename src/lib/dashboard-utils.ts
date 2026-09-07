export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const TRIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  quote: { label: "Quote", tone: "neutral" },
  pending_payment: { label: "Pending payment", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "info" },
  check_in_pending: { label: "Check-in available", tone: "info" },
  active: { label: "Active", tone: "success" },
  in_progress: { label: "Active", tone: "success" },
  check_out_pending: { label: "Return pending", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  pending: { label: "Pending", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "info" },
  partially_refunded: { label: "Partially refunded", tone: "info" },
  disputed: { label: "Disputed", tone: "danger" },
};

export const DOC_STATUS: Record<string, { label: string; tone: Tone }> = {
  not_submitted: { label: "Not submitted", tone: "neutral" },
  pending: { label: "Pending review", tone: "warning" },
  submitted: { label: "Pending review", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  approved: { label: "Verified", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  expired: { label: "Expired", tone: "warning" },
};

/** Primary next action for a guest, derived from trip status. */
export function tripAction(status: string, tripId: string): { label: string; to: string } {
  switch (status) {
    case "draft":
    case "quote":
      return { label: "Continue checkout", to: `/checkout/${tripId}` };
    case "pending_payment":
      return { label: "Complete payment", to: `/checkout/${tripId}` };
    case "confirmed":
    case "check_in_pending":
      return { label: "Start check-in", to: `/trips/${tripId}/check-in` };
    case "active":
    case "in_progress":
      return { label: "View active trip", to: `/trips/${tripId}` };
    case "check_out_pending":
      return { label: "Complete return", to: `/trips/${tripId}/check-out` };
    case "cancelled":
      return { label: "View cancellation", to: `/trips/${tripId}` };
    default:
      return { label: "View trip", to: `/trips/${tripId}` };
  }
}

/**
 * Customer-facing booking reference. Prefers the server-generated reference
 * stored on the trip; falls back to a deterministic value for legacy rows.
 */
export function bookingRef(tripId: string, createdAt?: string | null, reference?: string | null): string {
  if (reference) return reference;
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  const digits = tripId.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `RA-${year}-${digits}`;
}

export function money(cents: number | null | undefined, currency = "CAD") {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)} ${currency}`;
}
