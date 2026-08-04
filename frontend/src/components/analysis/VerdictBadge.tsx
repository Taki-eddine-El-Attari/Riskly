import { cn } from "@/lib/utils";
import { toneBadge, VERDICTS } from "@/lib/scores";
import type { Verdict } from "@/types/analysis";

const sizes = {
  sm: "px-2 py-1 text-[10px]",
  md: "px-2.5 py-1.5 text-xs",
  lg: "px-4 py-2 text-sm",
} as const;

export function VerdictBadge({
  verdict,
  size = "md",
  className,
}: {
  verdict: Verdict | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const meta = verdict ? VERDICTS[verdict] : undefined;

  if (!meta) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border border-border bg-bg-elevated font-mono uppercase tracking-wider text-text-faint",
          sizes[size],
          className,
        )}
      >
        Sans verdict
      </span>
    );
  }

  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center rounded-md border font-mono font-medium uppercase tracking-wider",
        toneBadge[meta.tone],
        sizes[size],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
