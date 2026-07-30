import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCsv, exportPdf } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import type { Analysis } from "@/types/analysis";

/**
 * Téléchargement d'un rapport ou d'un lot.
 *
 * Deux formats, deux usages : le PDF s'archive et se transmet, le CSV se
 * rouvre dans un tableur pour comparer. jsPDF n'est chargé qu'au clic.
 */
export function DownloadMenu({
  analyses,
  label,
  demo = false,
  variant = "ghost",
  className,
}: {
  analyses: Analysis[];
  /** Texte du bouton. Absent → bouton icône seule. */
  label?: string;
  /** Rapports de démonstration : les fichiers produits le mentionnent. */
  demo?: boolean;
  variant?: "ghost" | "outline";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  if (analyses.length === 0) return null;

  const many = analyses.length > 1;

  async function run(action: () => void | Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        aria-label={label ?? "Télécharger le rapport"}
        title={label ?? "Télécharger le rapport"}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg text-sm outline-none transition-colors duration-150",
          "focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50",
          variant === "outline"
            ? "border border-border bg-bg-elevated px-3 py-1.5 text-text hover:border-border-hover"
            : "px-2.5 py-1.5 text-text-muted hover:bg-bg hover:text-text",
          className,
        )}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Download className="size-4" aria-hidden />
        )}
        {label && <span>{label}</span>}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-text-faint">
          {many ? `${analyses.length} rapports` : "Ce rapport"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => void run(() => exportPdf(analyses, { demo }))}>
          <FileText aria-hidden />
          <span>
            Rapport PDF
            {many && <span className="ml-1 text-text-faint">· synthèse + détails</span>}
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => void run(() => exportCsv(analyses, { demo }))}>
          <FileSpreadsheet aria-hidden />
          <span>
            Tableau CSV
            {many && <span className="ml-1 text-text-faint">· comparatif</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
