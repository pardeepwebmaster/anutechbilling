/**
 * /deals — Deal Pipeline page.
 *
 * Re-uses the same component as /leads. The component reads usePathname()
 * internally and switches its mode:
 *   /leads → raw lead inbox (list view, NULL-plan filter)
 *   /deals → qualified deals pipeline (Kanban + list, plan-set filter)
 *
 * Route is gated in middleware:
 *   • owner / manager → always allowed
 *   • sales role     → allowed only when public.users.can_view_deals = true
 */
export { default } from "../leads/page";
