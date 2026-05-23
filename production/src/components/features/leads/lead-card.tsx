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

export function LeadCard({ lead, isDragging, onDragStart, onDragEnd, onClick }: LeadCardProps) {
  const ownerInitials = lead.contact_name ? initials(lead.contact_name) : "—";
  const age = formatDate(lead.created_at, "relative");

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
        "bg-paper border border-hairline rounded-lg p-3",
        "cursor-grab active:cursor-grabbing transition-all duration-150",
        "hover:border-hairline-strong hover:shadow-sm",
        isDragging && "opacity-40 -rotate-[1.5deg] shadow-md"
      )}
    >
      {/* Top row: company name + owner avatar */}
      <div className="flex justify-between items-start gap-2">
        <div className="text-[13px] font-medium leading-tight line-clamp-2 flex-1">
          {lead.company}
        </div>
        {lead.contact_name && (
          <Avatar initials={ownerInitials} color="indigo" size="sm" />
        )}
      </div>

      {/* Seats · plan */}
      <div className="text-[11px] text-ink-3 mt-1.5">
        {lead.seats ?? "—"} seats · {lead.plan ?? "—"}
      </div>

      {/* Bottom row: value (serif) | age */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-hairline">
        <span className="font-serif tabular-nums text-base">
          {lead.value !== null ? rupee(lead.value, { compact: true }) : "—"}
        </span>
        <span className="text-[11px] text-ink-3">{age}</span>
      </div>
    </div>
  );
}
