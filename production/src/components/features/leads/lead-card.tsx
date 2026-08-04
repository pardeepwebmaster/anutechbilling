/**
 * LeadCard — Kanban tile matching prototype design.
 */
import { Avatar } from "@/components/ui/avatar";
import { rupee, initials, formatDate } from "@/lib/utils";
import type { Lead } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  lead: Lead;
  isDragging?: boolean;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onClick?: (lead: Lead) => void;
}

// Deals ≥ this get a green highlight so the big-money cards pop on the board.
const HIGH_VALUE = 100_000; // ₹1L+

export function LeadCard({ lead, isDragging, onDragStart, onDragEnd, onClick }: LeadCardProps) {
  const ownerInitials = lead.contact_name ? initials(lead.contact_name) : "—";
  const age = formatDate(lead.created_at, "relative");
  const isHighValue = (lead.value ?? 0) >= HIGH_VALUE;

  return (
    <div
      data-lead-id={lead.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        onDragStart?.(lead.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(lead)}
      className={cn(
        "bg-paper border rounded-lg p-3",
        "cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-sm",
        // High-value deals get an emerald border + soft ring so they stand out.
        isHighValue
          ? "border-emerald/50 ring-1 ring-emerald/15 shadow-sm"
          : "border-hairline hover:border-hairline-strong",
        isDragging && "opacity-40 -rotate-[1.5deg] shadow-md",
      )}
    >
      {/* Top row: company name + owner avatar */}
      <div className="flex justify-between items-start gap-2">
        <div className="text-[13px] font-medium leading-tight line-clamp-1 flex-1" title={lead.company}>
          {lead.company}
        </div>
        {lead.contact_name && (
          <Avatar initials={ownerInitials} color="indigo" size="sm" />
        )}
      </div>

      {/* Seats · plan — single line, full text on hover (no more 5-line wrap). */}
      <div className="text-[11px] text-ink-3 mt-1.5 truncate" title={`${lead.seats ?? "—"} seats · ${lead.plan ?? "—"}`}>
        {lead.seats ?? "—"} seats · {lead.plan ?? "—"}
      </div>

      {/* Bottom row: value (serif) | age */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-hairline">
        <span className={cn("font-serif tabular-nums text-base inline-flex items-center gap-1", isHighValue && "text-emerald font-semibold")}>
          {isHighValue && <span aria-hidden className="text-[11px]">★</span>}
          {lead.value !== null ? rupee(lead.value, { compact: true }) : "—"}
        </span>
        <span className="text-[11px] text-ink-3">{age}</span>
      </div>
    </div>
  );
}
