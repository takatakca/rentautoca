/**
 * Server-only TAKATAK receiver boundary. The receiver is a Next.js endpoint
 * and must never be followed through HTTP redirects with signed headers.
 * An explicit origin override is for a separately approved staging endpoint.
 */
export function validateTakatakSyncUrl(
  raw: string | undefined,
  approvedOrigin?: string,
): string | null {
  if (!raw || raw !== raw.trim()) return null;

  try {
    const target = new URL(raw);
    if (
      target.protocol !== "https:" ||
      target.username !== "" ||
      target.password !== "" ||
      target.hash !== "" ||
      target.search !== "" ||
      (target.port !== "" && target.port !== "443") ||
      target.pathname !== "/api/integrations/rentauto/events"
    ) return null;

    if (approvedOrigin) {
      const allowed = new URL(approvedOrigin);
      if (
        allowed.protocol !== "https:" ||
        allowed.username !== "" ||
        allowed.password !== "" ||
        allowed.pathname !== "/" ||
        allowed.hash !== "" ||
        allowed.search !== "" ||
        (allowed.port !== "" && allowed.port !== "443") ||
        target.origin !== allowed.origin
      ) return null;
    } else if (
      target.hostname !== "takatak.ca" &&
      !target.hostname.endsWith(".takatak.ca")
    ) {
      return null;
    }

    return target.href;
  } catch {
    return null;
  }
}

/** HTTP success alone must never consume a durable outbox event. */
export function isTakatakSyncReceipt(value: unknown): boolean {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).accepted === true;
}
