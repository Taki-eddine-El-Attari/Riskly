import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ReportCard } from "@/components/analysis/ReportCard";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/hooks/useAnalysis";

/**
 * Rapport d'une analyse, ouvert en pleine page depuis l'historique.
 * Réutilise la carte de rapport de la page d'analyse (scores, signaux, détail
 * et téléchargement) — même lecture, adresse partageable.
 */
export default function ReportPage() {
  const { id = "" } = useParams();
  const report = useAnalysis(id);

  return (
    <AppShell>
      <section className="mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/history"
          className="inline-flex items-center gap-2 rounded-lg font-mono text-xs text-text-muted outline-none transition-colors duration-150 hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à l'historique
        </Link>

        <div className="mt-6">
          {report.isPending && (
            <div className="flex items-center gap-2 py-16 text-sm text-text-faint">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Chargement du rapport…
            </div>
          )}

          {report.isError && (
            <div className="flex max-w-2xl gap-3 rounded-xl border border-avoid/30 bg-avoid/10 p-5">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-avoid" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text">Rapport indisponible</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  {report.error.message}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void report.refetch()}>
                    <RotateCcw aria-hidden />
                    Réessayer
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/history">Retour à l'historique</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {report.data && <ReportCard analysis={report.data} defaultOpen />}
        </div>
      </section>
    </AppShell>
  );
}
