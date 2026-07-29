import { AlertTriangle, CircleSlash, History, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALERTS, toneText } from "@/lib/scores";
import type { Alert, AlertCode } from "@/types/analysis";

const ICONS: Record<AlertCode, LucideIcon> = {
  domaine_recent: AlertTriangle,
  aucune_autorite: CircleSlash,
  historique_discontinu: History,
  base_de_menaces: ShieldAlert,
};

const BORDERS: Record<string, string> = {
  good: "border-l-good",
  risky: "border-l-risky",
  avoid: "border-l-avoid",
  accent: "border-l-accent",
  faint: "border-l-border-hover",
};

/**
 * Les alertes de transparence (PRD §2.4.4).
 * Elles ne modifient ni le score ni le verdict — la mention est explicite,
 * et le ton reste informatif sauf pour la présence en base de menaces.
 */
export function AlertList({ alerts, className }: { alerts: Alert[]; className?: string }) {
  if (alerts.length === 0) return null;

  return (
    <section className={className}>
      <h4 className="font-mono text-[11px] uppercase tracking-widest text-text-faint">
        Signaux à connaître
      </h4>

      <ul className="mt-3 space-y-2">
        {alerts.map((alert) => {
          const meta = ALERTS[alert.code];
          if (!meta) return null;
          const Icon = ICONS[alert.code];

          return (
            <li
              key={alert.code}
              className={cn(
                "flex gap-3 rounded-lg border border-border border-l-2 bg-bg-elevated/50 p-3",
                BORDERS[meta.tone],
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", toneText[meta.tone])} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">{alert.message ?? meta.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{meta.hint}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-text-faint">
        Ces signaux éclairent la lecture : ils n'entrent ni dans le score ni dans le verdict.
      </p>
    </section>
  );
}
