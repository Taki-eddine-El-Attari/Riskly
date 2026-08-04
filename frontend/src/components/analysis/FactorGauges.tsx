import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { factorDirection, factorGauge, factorLabel, factorValue, sortFactors } from "@/lib/factors";
import type { Factor } from "@/types/analysis";

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function valueSize(value: string): string {
  if (value.length >= 7) return "text-[11px]";
  if (value.length >= 5) return "text-sm";
  return "text-base";
}

export function FactorGauges({
  factors,
  className,
  headerActions,
}: {
  factors: Factor[];
  className?: string;
  headerActions?: ReactNode;
}) {
  const sorted = sortFactors(factors);
  if (sorted.length === 0) return null;

  const gauges = sorted
    .map((factor) => ({ factor, gauge: factorGauge(factor) }))
    .filter((item): item is { factor: Factor; gauge: NonNullable<ReturnType<typeof factorGauge>> } =>
      item.gauge !== null,
    );
  const pills = sorted.filter((factor) => factorGauge(factor) === null);

  return (
    <section className={className}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
          Ce qui a pesé dans le score
        </h4>
        {headerActions}
      </div>

      {gauges.length > 0 && (
        <ul className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-5 xl:justify-center">
          {gauges.map(({ factor, gauge }) => {
            const direction = factorDirection(factor.contribution);
            const raisesRisk = direction.tone === "avoid";

            return (
              <li
                key={factor.feature}
                className="flex w-[7rem] flex-col items-center text-center"
                title={`${factorLabel(factor.feature)} : ${factorValue(factor)} — ${direction.label}`}
              >
                <div className="relative size-[80px]">
                  <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>            
                    {!gauge.full && (
                      <circle
                        cx="40"
                        cy="40"
                        r={RADIUS}
                        fill="none"
                        strokeWidth="5"
                        className="stroke-border"
                      />
                    )}
                    <circle
                      cx="40"
                      cy="40"
                      r={RADIUS}
                      fill="none"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={CIRCUMFERENCE * (1 - gauge.ratio)}
                      className={raisesRisk ? "stroke-avoid" : "stroke-good"}
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
                    <span
                      className={cn(
                        "font-mono font-medium leading-none tabular-nums",
                        valueSize(gauge.value),
                        raisesRisk ? "text-avoid" : "text-good",
                      )}
                    >
                      {gauge.value}
                    </span>
                    <span className="mt-1 max-w-full truncate font-mono text-[9px] leading-none text-text-faint">
                      {gauge.unit}
                    </span>
                  </div>
                </div>

                <span className="mt-2 text-[11px] leading-tight text-text-muted">
                  {factorLabel(factor.feature)}
                </span>
                <span
                  className={cn(
                    "mt-1 font-mono text-[9px] uppercase tracking-wider",
                    raisesRisk ? "text-avoid" : "text-good",
                  )}
                >
                  {raisesRisk ? "+ risque" : "− risque"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {pills.length > 0 && (
        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {pills.map((factor) => {
            const direction = factorDirection(factor.contribution);
            const raisesRisk = direction.tone === "avoid";

            return (
              <li
                key={factor.feature}
                title={direction.label}
                className={cn(
                  "flex items-baseline gap-2 rounded-lg border px-3 py-2",
                  raisesRisk
                    ? "border-avoid/30 bg-avoid/10"
                    : "border-good/30 bg-good/10",
                )}
              >
                <span className="text-[11px] text-text-muted">
                  {factorLabel(factor.feature)}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs",
                    raisesRisk ? "text-avoid" : "text-good",
                  )}
                >
                  {factorValue(factor)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
