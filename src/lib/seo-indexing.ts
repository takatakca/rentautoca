/**
 * Public marketing and vehicle-detail routes may be indexed.
 * Account, booking, payment and host/admin screens are always excluded.
 * The noindex directive is SEO hygiene, NOT access control; auth and RLS
 * must continue to protect private data.
 */
const PRIVATE_SECTIONS = [
  "/admin",
  "/checkout",
  "/dashboard",
  "/favorites",
  "/host",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/messages",
  "/more",
  "/profile",
  "/trips",
  "/become-host",
] as const;

export function shouldNoIndex(pathname: string, matchedKnownRoute: boolean): boolean {
  if (!matchedKnownRoute) return true;

  const normalized = (pathname === "/" ? "/" : pathname.replace(/\/+$/, "")).toLowerCase();

  // Saved concierge threads can contain personal travel and booking details.
  if (normalized.startsWith("/concierge/")) return true;

  return PRIVATE_SECTIONS.some(
    (section) => normalized === section || normalized.startsWith(`${section}/`),
  );
}
