import { AlertList } from "./AlertList";
import { FactorGauges } from "./FactorGauges";
import { MissingDataNotice } from "./MissingDataNotice";
import { cn } from "@/lib/utils";
import type { Analysis } from "@/types/analysis";

/** Une ligne du tableau des données collectées. */
function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd
        className={cn(
          "shrink-0 font-mono text-xs",
          value ? "text-text" : "text-text-faint",
        )}
      >
        {value ?? "Non collecté"}
      </dd>
    </div>
  );
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCount(value: number | null | undefined): string | null {
  return typeof value === "number" ? value.toLocaleString("fr-FR") : null;
}

/**
 * Le corps d'un rapport : facteurs explicatifs, alertes, données collectées.
 * Réutilisé tel quel par la carte dépliée (page Analyse) et par la page
 * Rapport ouverte depuis l'historique.
 */
export function ReportDetail({
  analysis,
  id,
  className,
}: {
  analysis: Analysis;
  id?: string;
  className?: string;
}) {
  const { domain, metric } = analysis;
  const factors = analysis.shap_values ?? [];
  const alerts = analysis.alerts ?? [];
  const missing = analysis.missing_sources ?? [];

  return (
    <div id={id} className={cn("space-y-8", className)}>
      {factors.length > 0 ? (
        <FactorGauges factors={factors} />
      ) : (
        <p className="text-sm text-text-faint">
          Les facteurs explicatifs ne sont pas disponibles pour cette analyse.
        </p>
      )}

      {alerts.length > 0 && <AlertList alerts={alerts} />}

      <section>
        <h4 className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
          Données collectées
        </h4>
        {/* Deux colonnes de lignes : les valeurs restent près de leur libellé
            plutôt qu'à l'autre bout d'une ligne pleine largeur. */}
        <dl className="mt-3 grid gap-x-8 rounded-lg border border-border bg-bg-elevated/40 px-4 py-1 sm:grid-cols-2">
          <DataRow label="Extension" value={domain?.tld ?? null} />
          <DataRow
            label="Longueur du nom"
            value={
              typeof domain?.domain_length === "number"
                ? `${domain.domain_length} caractères`
                : null
            }
          />
          <DataRow label="Tirets" value={formatCount(domain?.hyphen_count)} />
          <DataRow label="Enregistré le" value={formatDate(domain?.whois_creation_date)} />
          <DataRow label="Expire le" value={formatDate(domain?.whois_expiration_date)} />
          <DataRow label="Pays d'hébergement" value={domain?.country ?? null} />
          <DataRow
            label="Autorité (Open PageRank)"
            value={
              typeof metric?.rank_value === "number"
                ? `${metric.rank_value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 10`
                : null
            }
          />
          <DataRow
            label="Domaines référents"
            value={formatCount(metric?.referring_domains_count)}
          />
          <DataRow label="Serveurs de noms" value={formatCount(metric?.nb_server_count)} />
          <DataRow
            label="Blacklists DNS"
            value={
              typeof metric?.is_blacklisted === "boolean"
                ? metric.is_blacklisted
                  ? "Présent sur au moins une liste"
                  : "Aucune liste"
                : null
            }
          />
        </dl>
      </section>

      {missing.length > 0 && <MissingDataNotice sources={missing} />}
    </div>
  );
}
