import { ReportCard } from "./ReportCard";
import { cn } from "@/lib/utils";
import { toneText, VERDICT_ORDER, VERDICTS } from "@/lib/scores";
import type { Analysis, Verdict } from "@/types/analysis";

function byRiskAscending(a: Analysis, b: Analysis): number {
  const left = a.risk_score ?? Number.POSITIVE_INFINITY;
  const right = b.risk_score ?? Number.POSITIVE_INFINITY;
  return left - right;
}

function groupByVerdict(analyses: Analysis[]): [Verdict | "sans_verdict", Analysis[]][] {
  const groups = new Map<Verdict | "sans_verdict", Analysis[]>();

  for (const analysis of analyses) {
    const key = analysis.verdict ?? "sans_verdict";
    const bucket = groups.get(key);
    if (bucket) bucket.push(analysis);
    else groups.set(key, [analysis]);
  }

  const ordered: (Verdict | "sans_verdict")[] = [...VERDICT_ORDER, "sans_verdict"];
  return ordered
    .filter((key) => groups.has(key))
    .map((key) => [key, groups.get(key)!.sort(byRiskAscending)]);
}

export function ReportList({
  analyses,
  className,
}: {
  analyses: Analysis[];
  className?: string;
}) {
  if (analyses.length === 0) return null;

  if (analyses.length === 1) {
    return <ReportCard analysis={analyses[0]} defaultOpen className={className} />;
  }

  const groups = groupByVerdict(analyses);

  return (
    <div className={cn("space-y-10", className)}>
      {groups.map(([key, items]) => {
        const meta = key === "sans_verdict" ? null : VERDICTS[key];

        return (
          <section key={key}>
            <div className="flex items-center gap-3">
              <h2
                className={cn(
                  "font-mono text-xs uppercase tracking-widest",
                  meta ? toneText[meta.tone] : "text-text-faint",
                )}
              >
                {meta ? meta.label : "Sans verdict"}
              </h2>
              <span className="font-mono text-xs text-text-faint">
                {items.length} {items.length > 1 ? "domaines" : "domaine"}
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>

            <div className="mt-4 space-y-4">
              {items.map((analysis) => (
                <ReportCard key={analysis.id} analysis={analysis} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
