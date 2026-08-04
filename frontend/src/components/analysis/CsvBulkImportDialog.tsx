import { useEffect, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { readWarmupFile, WarmupError } from "@/lib/warmup";
import { buildDomainCsvFile, groupByDomain, parseCsvTable, type DomainGroup } from "@/lib/csvDomains";
import { isValidDomain } from "@/lib/domains";
import { MAX_CSV_IMPORT_DOMAINS } from "@/lib/constants";
import type { BulkDomainJob } from "@/hooks/useBulkAnalyses";
import { cn } from "@/lib/utils";

type Status =
  | { kind: "parsing" }
  | { kind: "error"; message: string }
  | {
      kind: "preview";
      header: string[];
      capped: DomainGroup[];
      overflowCount: number;
      overflowNames: string[];
      invalidCount: number;
    };

export function CsvBulkImportDialog({
  file,
  onOpenChange,
  onConfirm,
}: {
  file: File | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (jobs: BulkDomainJob[]) => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: "parsing" });
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setStatus({ kind: "parsing" });
    setChecked(new Set());

    (async () => {
      try {
        await readWarmupFile(file);
        const table = await parseCsvTable(await file.text());
        const grouped = groupByDomain(table);
        if (cancelled) return;

        if (!grouped.hasDomainColumn) {
          setStatus({
            kind: "error",
            message:
              "Ce fichier ne contient pas de colonne « domain_name ». Utilisez le champ de saisie pour l'attacher à un domaine précis.",
          });
          return;
        }

        const valid = grouped.groups.filter((g) => isValidDomain(g.domain));
        const capped = valid.slice(0, MAX_CSV_IMPORT_DOMAINS);
        const overflow = valid.slice(MAX_CSV_IMPORT_DOMAINS);

        setStatus({
          kind: "preview",
          header: grouped.header,
          capped,
          overflowCount: overflow.length,
          overflowNames: overflow.map((g) => g.domain),
          invalidCount: grouped.groups.length - valid.length,
        });
        setChecked(new Set(capped.map((g) => g.domain)));
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: err instanceof WarmupError ? err.message : "Fichier illisible.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const open = file !== null;

  function toggle(domain: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function toggleAll(capped: DomainGroup[]) {
    setChecked((current) =>
      current.size === capped.length ? new Set() : new Set(capped.map((g) => g.domain)),
    );
  }

  function confirm() {
    if (status.kind !== "preview") return;
    const jobs: BulkDomainJob[] = status.capped
      .filter((g) => checked.has(g.domain))
      .map((g) => ({
        domain: g.domain,
        warmup: buildDomainCsvFile(status.header, g.rows, `${g.domain}.csv`),
      }));
    onConfirm(jobs);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer un CSV multi-domaines</DialogTitle>
          <DialogDescription>
            {status.kind === "preview"
              ? "Domaines détectés dans le fichier — décochez ceux à exclure de l'analyse."
              : "Le fichier est lu localement ; rien n'est envoyé avant votre confirmation."}
          </DialogDescription>
        </DialogHeader>

        {status.kind === "parsing" && (
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

        {status.kind === "preview" && (
          <>
            {status.overflowCount > 0 && (
              <p className="mb-3 rounded-lg border border-risky/30 bg-risky/10 px-3 py-2 text-xs text-risky">
                Limite de {MAX_CSV_IMPORT_DOMAINS} domaines par import : {status.overflowCount}{" "}
                domaine{status.overflowCount > 1 ? "s" : ""} ignoré
                {status.overflowCount > 1 ? "s" : ""} (au-delà de la limite) —{" "}
                {status.overflowNames.slice(0, 5).join(", ")}
                {status.overflowNames.length > 5 ? "…" : ""}
              </p>
            )}
            {status.invalidCount > 0 && (
              <p className="mb-3 text-xs text-text-faint">
                {status.invalidCount} domaine{status.invalidCount > 1 ? "s" : ""} au format
                invalide ignoré{status.invalidCount > 1 ? "s" : ""}.
              </p>
            )}

            {status.capped.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                Aucun domaine exploitable trouvé dans ce fichier.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="font-mono text-xs text-text-faint">
                    {checked.size} / {status.capped.length} sélectionné
                    {checked.size > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAll(status.capped)}
                    className="rounded px-1 text-xs text-accent outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-accent/30"
                  >
                    {checked.size === status.capped.length
                      ? "Tout désélectionner"
                      : "Tout sélectionner"}
                  </button>
                </div>

                <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {status.capped.map((group) => {
                    const isChecked = checked.has(group.domain);
                    return (
                      <li key={group.domain}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-150",
                            isChecked
                              ? "border-accent bg-accent/10"
                              : "border-border bg-bg hover:border-border-hover",
                          )}
                        >
                          <Checkbox checked={isChecked} onCheckedChange={() => toggle(group.domain)} />
                          <FileSpreadsheet className="size-3.5 shrink-0 text-accent" aria-hidden />
                          <span className="min-w-0 flex-1 truncate font-mono text-sm text-text">
                            {group.domain}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-text-faint">
                            {group.rows.length.toLocaleString("fr-FR")} ligne
                            {group.rows.length > 1 ? "s" : ""}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {status.kind === "error" ? "Fermer" : "Annuler"}
          </Button>
          {status.kind === "preview" && status.capped.length > 0 && (
            <Button type="button" onClick={confirm} disabled={checked.size === 0}>
              {checked.size > 1 ? `Importer ${checked.size} domaines` : "Importer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
