/**
 * /portal — root redirect. Logged-in customer → /portal/dashboard,
 * everyone else → /portal/login.
 */
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

export default async function PortalRootPage() {
  const session = await getPortalSession();
  if (session) redirect("/portal/dashboard");
  redirect("/portal/login");
}
