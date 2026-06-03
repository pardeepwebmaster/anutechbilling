/**
 * SeatUsage — "X of Y users active" with a utilization bar. Pure presentational
 * (no hooks) so it works in both Server and Client portal pages. Surfaces the
 * subscriptions.used data the customer couldn't see before — helps them right-
 * size before renewal (and nudges an upsell when they're near the cap).
 */
export function SeatUsage({ used, seats }: { used: number; seats: number }) {
  const safeSeats = Math.max(seats, 0);
  const safeUsed = Math.max(Math.min(used ?? 0, safeSeats || used), 0);
  const pct = safeSeats > 0 ? Math.round((safeUsed / safeSeats) * 100) : 0;
  const near = safeSeats > 0 && safeUsed / safeSeats >= 0.9; // ≥90% → near cap

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-ink-3 font-semibold">
          Seats in use
        </span>
        <span className="text-xs text-ink-2 font-medium">
          {safeUsed} of {safeSeats}
          {near && <span className="text-amber-ink"> · near limit</span>}
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-paper-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={safeUsed}
        aria-valuemin={0}
        aria-valuemax={safeSeats}
        aria-label={`${safeUsed} of ${safeSeats} seats in use`}
      >
        <div
          className={`h-full rounded-full ${near ? "bg-amber" : "bg-emerald"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
