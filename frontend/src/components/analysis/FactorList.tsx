import { cn } from "@/lib/utils";
import { factorDirection, factorLabel, factorValue, sortFactors } from "@/lib/factors";
import type { Factor } from "@/types/analysis";

export function FactorList({
  factors,
  limit = 6,
  className,
}: {
  factors: Factor[];
  limit?: number;
  className?: string;
}) {
  const sorted = sortFactors(factors).slice(0, limit);
  if (sorted.length === 0) return null;

  const max = Math.max(...sorted.map((f) => Math.abs(f.contribution))) || 1;

  return (
    <section className={className}>
      <h4 className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
        Ce qui a pesé dans le score
      </h4>

      <ul className="mt-3 space-y-3">
        {sorted.map((factor) => {
          const direction = factorDirection(factor.contribution);
          const width = `${Math.max(4, (Math.abs(factor.contribution) / max) * 50)}%`;
          const raisesRisk = direction.tone === "avoid";

          return (
            <li key={factor.feature}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="truncate text-sm text-text">{factorLabel(factor.feature)}</span>
                <span className="shrink-0 font-mono text-xs text-text-muted">
                  {factorValue(factor)}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-3">
                <div className="relative h-1.5 flex-1 rounded-full bg-bg">
                  <span
                    className="absolute inset-y-[-3px] left-1/2 w-px bg-border-hover"
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "absolute top-0 h-1.5 rounded-full",
                      raisesRisk ? "left-1/2 bg-avoid" : "right-1/2 bg-good",
                    )}
                    style={{ width }}
                    aria-hidden
                  />
                </div>
                <span
                  className={cn(
                    "w-36 shrink-0 text-right font-mono text-[10px] uppercase tracking-wider",
                    raisesRisk ? "text-avoid" : "text-good",
                  )}
                >
                  {direction.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
