/**
 * Membership decision for a first-time sign-in. Pure + testable — this is the
 * security-critical branch of the OAuth callback: a brand-new Google user either
 * JOINS an existing tenant (only when an explicit owner invite matches their
 * email) or gets a fresh tenant of their own. No invite → never joins someone
 * else's tenant (tenant-leak guard, CLAUDE.md §4).
 */
export type UserRole = "owner" | "sales" | "accountant" | "support";

export function normalizeEmail(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase();
}

export interface InviteMatch {
  tenant_id: string;
  role: UserRole;
}

export type MembershipDecision =
  | { mode: "join"; tenantId: string; role: UserRole }
  | { mode: "new" };

/**
 * @param invite the invite row matched by the user's (lower-cased) email, or null.
 * Only a non-empty tenant_id on a real invite triggers a join; everything else
 * falls through to creating a new tenant.
 */
export function decideMembership(invite: InviteMatch | null | undefined): MembershipDecision {
  if (invite && invite.tenant_id) {
    return { mode: "join", tenantId: invite.tenant_id, role: invite.role };
  }
  return { mode: "new" };
}
