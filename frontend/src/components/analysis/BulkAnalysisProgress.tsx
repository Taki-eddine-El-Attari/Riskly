import { cn } from "@/lib/utils";

export function BulkAnalysisProgress({
  progress,
  className,
}: {
  progress: { done: number; total: number };
  className?: string;
}) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-avoid/60" />
          <span className="size-2.5 rounded-full bg-risky/60" />
          <span className="size-2.5 rounded-full bg-good/60" />
        </div>
        <span className="font-mono text-xs text-text-faint">riskly · analyse</span>
        <span className="ml-auto font-mono text-xs text-text-faint">
          import CSV · {progress.total} domaines
        </span>
      </div>

      <div className="p-5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="mt-3 text-center font-mono text-sm text-text">
          {progress.done} / {progress.total} domaines analysés
        </p>

        <p className="mt-5 border-t border-border pt-4 text-xs text-text-muted">
          Traitement par lots pour respecter les quotas des sources externes.
          Un domaine qui échoue n'interrompt pas les autres.
        </p>
      </div>
    </div>
  );
}
