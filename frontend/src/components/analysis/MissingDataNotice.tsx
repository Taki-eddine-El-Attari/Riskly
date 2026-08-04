import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function MissingDataNotice({
  sources,
  className,
}: {
  sources: string[];
  className?: string;
}) {
  if (sources.length === 0) return null;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-border bg-bg-elevated/50 p-3",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-text-faint" aria-hidden />
      <div className="min-w-0 text-xs leading-relaxed text-text-muted">
        <p>
          Analyse produite sans{" "}
          <span className="font-mono text-text-faint">{sources.join(" · ")}</span>
          {sources.length > 1 ? " : ces sources n'ont pas répondu." : " : cette source n'a pas répondu."}
        </p>
        <p className="mt-1 text-text-faint">
          Le score repose donc sur une information partielle.
        </p>
      </div>
    </div>
  );
}
