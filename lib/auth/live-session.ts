import { isRole } from "./roles";

// A token is live only while its session version matches the account's. Sign-out bumps the version,
// so a copied token stops working even though the browser cookie is already gone.
export function isLiveAccount(current: { role: string; sessionVersion: number } | undefined, tokenVersion: number | undefined): boolean {
  return !!current && isRole(current.role) && tokenVersion === current.sessionVersion;
}
