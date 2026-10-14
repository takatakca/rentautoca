export const RENTAUTO_ROLES = ["guest", "host", "admin"] as const;
export type RentautoRole = (typeof RENTAUTO_ROLES)[number];

export function isRentautoRole(role: unknown): role is RentautoRole {
  return typeof role === "string" && RENTAUTO_ROLES.includes(role as RentautoRole);
}

/**
 * Only membership in rentauto.account_roles can unlock Rentauto pages.
 * JWT/user_metadata from the shared TAKATAK identity provider is never
 * sufficient to authorize a Rentauto vertical.
 */
export function normalizeRentautoRoles(
  rows: ReadonlyArray<{ role: unknown }>,
): RentautoRole[] {
  return [...new Set(rows.map(({ role }) => role).filter(isRentautoRole))];
}

export function isRentautoMember(roles: readonly string[]): boolean {
  return roles.some(isRentautoRole);
}
