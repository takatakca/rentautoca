/**
 * SEO + consent kit: the ONE settings file per site.
 *
 * Rules:
 * - Only facts already present in this repo. Never invent an address, hours, phone, rating or review.
 * - Unknown values stay `undefined` with a `TODO(owner)` comment; the JSON-LD builder skips them.
 * - `url` is the real production domain (see foodhubca/private/hosting/MOCHAHOST_DOMAINS.md), never *.lovable.app.
 */

export type SchemaType =
  | "Organization"
  | "LocalBusiness"
  | "Restaurant"
  | "NGO"
  | "SportsOrganization"
  | "Event";

export type PostalAddress = {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode?: string | undefined;
  addressCountry: string;
};

export type SiteConfig = {
  /** Public business name. */
  name: string;
  /** Legal name if different (TODO(owner) when unknown). */
  legalName?: string | undefined;
  /** Real production origin, no trailing slash. */
  url: string;
  /** <html lang>. French first (Québec). */
  lang: "fr-CA";
  /** Open Graph locale. */
  locale: "fr_CA";
  defaultTitle: string;
  defaultDescription: string;
  /** Default share image: path under /public or absolute URL. undefined = no og:image. */
  ogImage?: string | undefined;
  /** Logo: path under /public or absolute URL. */
  logo?: string | undefined;
  schemaType: SchemaType;
  email?: string | undefined;
  /** E.164, e.g. "+15145550000". */
  phone?: string | undefined;
  address?: PostalAddress | undefined;
  /** Real social profile URLs only (no "#", no generic facebook.com). */
  sameAs: string[];
  /** Privacy policy route, used by the cookie banner. undefined = no page yet (TODO(owner)). */
  privacyPath?: string | undefined;
  /** Law 25 privacy officer. */
  privacyOfficer: { name?: string | undefined; email?: string | undefined };
};

export const SITE: SiteConfig = {
  name: "Rentauto",
  // TODO(owner): registered legal name of the company operating Rentauto.ca.
  legalName: undefined,
  url: "https://rentauto.ca",
  lang: "fr-CA",
  locale: "fr_CA",
  // TODO(owner): French title/description (site is English only today).
  defaultTitle: "Rentauto.ca — Peer-to-peer car rental in Canada",
  defaultDescription:
    "Skip the rental counter. Rent cars from trusted local hosts across Canada. Book unique vehicles at great prices.",
  // TODO(owner): 1200x630 share image in /public (e.g. og-default.jpg), then set it here and in index.html.
  ogImage: undefined,
  // TODO(owner): real logo file in /public (today only the Lovable favicon exists).
  logo: undefined,
  schemaType: "Organization",
  email: "support@rentauto.ca",
  // TODO(owner): public phone number, if any.
  phone: undefined,
  // TODO(owner): business address (only "Built in Quebec" is known).
  address: undefined,
  // TODO(owner): real social profile URLs.
  sameAs: [],
  privacyPath: "/privacy",
  // TODO(owner): name of the person responsible for personal information (Law 25). Email from /privacy.
  privacyOfficer: { name: undefined, email: "privacy@rentauto.ca" },
};
