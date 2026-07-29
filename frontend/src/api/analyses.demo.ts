// Jeu de démonstration.
//
// Les routes `/analyses` ne sont pas encore montées côté backend
// (app/api/v1/router.py n'inclut que `auth`). Tant qu'elles ne répondent pas,
// la page d'analyse s'appuie sur ces rapports d'exemple et l'affiche
// clairement (bandeau « données de démonstration »).
//
// À SUPPRIMER une fois l'endpoint disponible : ce fichier et le repli dans
// `analyses.api.ts` sont les deux seuls points à retirer.

import type { Analysis, Factor } from "@/types/analysis";
import { tldOf } from "@/lib/domains";

/** Empreinte stable d'une chaîne → mêmes scores pour le même domaine. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(seed: number, values: T[]): T {
  return values[seed % values.length];
}

const RISKY_TLDS = [".xyz", ".top", ".click", ".buzz", ".click", ".info"];

export function demoAnalysis(domainName: string): Analysis {
  const seed = hash(domainName);
  const tld = tldOf(domainName);

  // Les domaines à extension bon marché et les noms très tiretés tirent un
  // profil plus risqué : la démo reste plausible plutôt qu'aléatoire.
  const penalty =
    (RISKY_TLDS.includes(tld) ? 38 : 0) +
    (domainName.split("-").length - 1) * 9 +
    (domainName.length > 22 ? 8 : 0);

  const riskScore = Math.min(97, Math.max(3, (seed % 45) + penalty));
  const ageDays = (seed % 5200) + (penalty > 30 ? 4 : 400);
  const pageRank = penalty > 30 ? (seed % 12) / 10 : 2 + (seed % 60) / 10;
  const referring = penalty > 30 ? seed % 40 : (seed % 4000) + 60;
  const inThreatDb = riskScore > 74;
  const blacklisted = riskScore > 84;
  const servers = 2 + (seed % 3);

  const authorityScore = Math.round(
    Math.min(
      100,
      0.5 * (pageRank * 10) +
        0.3 * Math.min(100, (referring / 4000) * 100) +
        0.2 * Math.min(100, (ageDays / 5475) * 100),
    ),
  );

  const factors: Factor[] = [
    { feature: "age_domaine", value: ageDays, contribution: ageDays > 720 ? -0.31 : 0.27 },
    { feature: "open_page_rank", value: pageRank, contribution: pageRank > 2 ? -0.22 : 0.18 },
    { feature: "referring_domains", value: referring, contribution: referring > 200 ? -0.16 : 0.09 },
    { feature: "is_in_threat_db", value: inThreatDb, contribution: inThreatDb ? 0.42 : -0.19 },
    { feature: "is_blacklisted", value: blacklisted, contribution: blacklisted ? 0.29 : -0.12 },
    { feature: "tld", value: tld, contribution: RISKY_TLDS.includes(tld) ? 0.21 : -0.06 },
    { feature: "nbr_hyp", value: domainName.split("-").length - 1, contribution: 0.05 },
    { feature: "nbr_serv", value: servers, contribution: -0.04 },
  ];

  const alerts: Analysis["alerts"] = [];
  if (ageDays < 30) alerts.push({ code: "domaine_recent" });
  if (pageRank === 0) alerts.push({ code: "aucune_autorite" });
  if (inThreatDb) alerts.push({ code: "base_de_menaces" });
  if (seed % 7 === 0) alerts.push({ code: "historique_discontinu" });

  // Une source muette de temps en temps : le rapport partiel fait partie du
  // parcours nominal (PRD, UC-03 scénario A5).
  const missing = seed % 5 === 0 ? ["ip-api"] : [];

  const created = new Date(Date.now() - ageDays * 86_400_000);
  const now = new Date();

  return {
    id: `demo-${seed.toString(16)}`,
    status: missing.length > 0 ? "partial" : "completed",
    risk_score: riskScore,
    authority_score: authorityScore,
    verdict: null, // recalculé par la matrice dans le sélecteur du rapport
    shap_values: factors,
    requested_at: now.toISOString(),
    completed_at: now.toISOString(),
    domain: {
      id: `demo-domain-${seed.toString(16)}`,
      domain_name: domainName,
      tld,
      country: pick(seed, ["FR", "US", "DE", "NL", "MA"]),
      domain_length: domainName.length,
      hyphen_count: domainName.split("-").length - 1,
      whois_creation_date: created.toISOString().slice(0, 10),
      whois_expiration_date: new Date(now.getTime() + 220 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      first_analysis: now.toISOString(),
    },
    alerts,
    missing_sources: missing,
    cached_at: seed % 6 === 0 ? new Date(now.getTime() - 3 * 3600_000).toISOString() : null,
    metric: {
      rank_value: pageRank,
      rank_source: "Open PageRank",
      backlink_count: referring * 7,
      referring_domains_count: referring,
      nb_server_count: servers,
      is_blacklisted: blacklisted,
    },
  };
}
