export const STORE_ID = 1;

export const STORE_IDS = [1];

/** Platform subdomains that are never treated as tenant subdomains. */
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "super-admin",
  "auth",
  "billing",
  "platform",
]);

export type TenantHost = {
  host: string;
  baseDomain: string;
  subdomain: string | null;
  isTenantHost: boolean;
};

/**
 * `[tenant].storeflow.io` host parsing. Local dev serves on localhost so
 * `acme.localhost:3000` is treated the same way via APP_DOMAIN="localhost".
 */
export function parseTenantHost(host: string | null): TenantHost {
  const clean = (host ?? "").replace(/:\d+$/, "").toLowerCase(); // "acme.storeflow.io"
  const baseDomain = (process.env.APP_DOMAIN ?? "storeflow.io").toLowerCase();

  if (!clean.endsWith(`.${baseDomain}`) && clean !== baseDomain) {
    return { host: clean, baseDomain, subdomain: null, isTenantHost: false };
  }
  if (clean === baseDomain) {
    return { host: clean, baseDomain, subdomain: null, isTenantHost: false };
  }
  const subdomain = clean.slice(0, clean.length - baseDomain.length - 1);
  const isTenantHost = subdomain !== "" && !RESERVED_SUBDOMAINS.has(subdomain);
  return { host: clean, baseDomain, subdomain: isTenantHost ? subdomain : null, isTenantHost };
}

/** True when the current browser host is a tenant subdomain. */
export function isTenantSubdomainHost(): boolean {
  if (typeof window === "undefined") return false;
  return parseTenantHost(window.location.hostname).isTenantHost;
}

/** `acme` when running on `acme.storeflow.io`, null otherwise. */
export function currentTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  return parseTenantHost(window.location.hostname).subdomain;
}