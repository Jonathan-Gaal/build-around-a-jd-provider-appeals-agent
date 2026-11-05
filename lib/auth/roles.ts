/** Public role metadata; never an authorization authority in the browser. */
export const ROLES = ["clinician", "coordinator", "supervisor", "packet_staff"] as const;
export type Role = typeof ROLES[number];
export const ROLE_LABELS: Record<Role, string> = { clinician: "Clinician", coordinator: "Coordinator", supervisor: "Manager", packet_staff: "Packet preparation" };
export function isRole(value: string): value is Role { return ROLES.some(role => role === value); }
export function roleHome(role: string): string {
  return role === "clinician" ? "/" : role === "coordinator" ? "/roles/coordinator" : role === "supervisor" ? "/roles/manager" : role === "packet_staff" ? "/roles/submission" : "/login";
}
