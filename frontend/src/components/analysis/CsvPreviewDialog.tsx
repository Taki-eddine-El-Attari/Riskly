import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/warmup";
import { groupByDomain, parseCsvTable, type CsvTable } from "@/lib/csvDomains";

const PREVIEW_ROW_LIMIT = 50;

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; table: CsvTable; domainCounts: { domain: string; rows: number }[] };

export function CsvPreviewDialog({
  file,
  onOpenChange,
}: {
  file: File | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setStatus({ kind: "loading" });

    (async () => {
      try {
        const table = await parseCsvTable(await file.text());
        if (cancelled) return;
        const grouped = groupByDomain(table);
        setStatus({
          kind: "ready",
          table,
          domainCounts: grouped.hasDomainColumn
            ? grouped.groups.map((g) => ({ domain: g.domain, rows: g.rows.length }))
            : [],
        });
      } catch {
        if (cancelled) return;
        setStatus({ kind: "error", message: "Ce fichier n'a pas pu être lu comme un CSV." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const open = file !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{file?.name ?? "Aperçu du CSV"}</DialogTitle>
          <DialogDescription>
            {file && `${formatBytes(file.size)}`}
            {status.kind === "ready" && ` · ${status.table.rows.length.toLocaleString("fr-FR")} ligne${status.table.rows.length > 1 ? "s" : ""}`}
          </DialogDescription>
        </DialogHeader>

        {status.kind === "loading" && (
          <div className="flex items-center gap-2 py-6 text-sm text-text-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Lecture du fichier…
          </div>
        )}

        {status.kind === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-avoid/30 bg-avoid/10 p-3 text-sm text-avoid">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {status.message}
          </div>
        )}

        {status.kind === "ready" && (
          <>
            {status.domainCounts.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {status.domainCounts.map((d) => (
                  <span
                    key={d.domain}
                    className="rounded-full border border-border bg-bg px-2 py-0.5 font-mono text-[10px] text-text-muted"
                  >
                    {d.domain} · {d.rows}
                  </span>
                ))}
              </div>
            )}

            <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-max border-collapse text-left font-mono text-[11px]">
                <thead className="sticky top-0 bg-bg-elevated">
                  <tr>
                    {status.table.header.map((col, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap border-b border-border px-2 py-1.5 font-medium text-text-faint"
                      >
                        {col || `col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {status.table.rows.slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                    <tr key={i} className="odd:bg-bg-elevated/30">
                      {row.map((cell, j) => (
                        <td key={j} className="whitespace-nowrap px-2 py-1 text-text">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {status.table.rows.length > PREVIEW_ROW_LIMIT && (
              <p className="mt-2 text-xs text-text-faint">
                Aperçu limité aux {PREVIEW_ROW_LIMIT} premières lignes sur{" "}
                {status.table.rows.length.toLocaleString("fr-FR")}.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
