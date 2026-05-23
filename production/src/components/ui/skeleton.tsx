/**
 * Skeleton — pulsing placeholder for loading states.
 *
 * @example
 * <Skeleton className="h-4 w-32" />
 * <SkeletonText lines={3} />
 * <SkeletonCard />
 * <SkeletonRow cols={5} />
 */
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Override animation duration (in seconds) */
  duration?: number;
}

function Skeleton({ className, duration = 1.4, style, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("skeleton-shimmer rounded-md", className)}
      style={{ animationDuration: `${duration}s`, ...style }}
      {...props}
    />
  );
}

/** Multi-line text placeholder */
function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-3",
            i === lines - 1 ? "w-2/3" : "w-full",
            i === 0 && lines > 2 ? "w-3/4" : ""
          )}
        />
      ))}
    </div>
  );
}

/** A full card placeholder */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("border border-hairline rounded-lg p-4 bg-paper", className)}>
      <div className="flex items-start gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

/** Table row placeholder */
function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton
            className={cn(
              "h-3",
              i === 0 ? "w-32" : i === cols - 1 ? "w-16" : "w-24"
            )}
          />
        </td>
      ))}
    </tr>
  );
}

/** KPI tile placeholder */
function SkeletonKPI({ className }: { className?: string }) {
  return (
    <div className={cn("border border-hairline rounded-lg p-4 bg-paper space-y-2", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

/** Avatar circle placeholder */
function SkeletonAvatar({ size = 32 }: { size?: number }) {
  return <Skeleton className="rounded-full" style={{ width: size, height: size }} />;
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonRow, SkeletonKPI, SkeletonAvatar };
