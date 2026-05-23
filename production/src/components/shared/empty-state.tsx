/**
 * EmptyState — illustrated nudge for empty lists and "not yet" states.
 *
 * @example
 * <EmptyState
 *   icon="inbox"
 *   title="No leads yet"
 *   body="Leads will appear here when customers fill the contact form."
 *   action={<Button variant="primary" icon="plus">Add lead manually</Button>}
 *   sample={{ onClick: loadSampleData }}
 * />
 */
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: string;
  title: string;
  body?: React.ReactNode;
  /** Primary CTA */
  action?: React.ReactNode;
  /** Secondary CTA */
  secondary?: React.ReactNode;
  /** Show "or load sample data" link */
  sample?: { onClick: () => void };
  className?: string;
  /** Smaller variant for inline use (e.g., inside a card) */
  compact?: boolean;
}

export function EmptyState({
  icon = "inbox",
  title,
  body,
  action,
  secondary,
  sample,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center max-w-md mx-auto",
        compact ? "py-6 px-4" : "py-12 px-6",
        className
      )}
    >
      {/* Illustrated icon */}
      <div
        className={cn(
          "rounded-full grid place-items-center text-amber",
          "shadow-[0_8px_24px_rgba(194,65,12,0.08)] ring-1 ring-hairline",
          "bg-gradient-to-br from-amber-soft to-paper-2",
          compact ? "w-14 h-14 mb-3" : "w-20 h-20 mb-4"
        )}
      >
        <Icon name={icon} size={compact ? 22 : 32} />
      </div>

      <h3
        className={cn(
          "font-serif text-ink leading-tight mb-2",
          compact ? "text-lg" : "text-xl"
        )}
      >
        {title}
      </h3>

      {body && (
        <p
          className={cn(
            "text-ink-3 leading-relaxed mb-5",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {body}
        </p>
      )}

      {(action || secondary) && (
        <div className="flex justify-center gap-2 flex-wrap">
          {action}
          {secondary}
        </div>
      )}

      {sample && (
        <p className="mt-4 text-xs text-ink-3">
          Or{" "}
          <button
            type="button"
            onClick={sample.onClick}
            className="text-indigo underline underline-offset-2 hover:text-indigo-ink"
          >
            load sample data
          </button>{" "}
          to explore
        </p>
      )}
    </div>
  );
}
