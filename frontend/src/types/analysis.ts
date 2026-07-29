// Miroir des schemas Pydantic backend (app/schemas/analysis.py → AnalysisOut,
// app/schemas/domain.py → DomainOut).
//
// Le backend est encore en cours : certains champs prévus par le PRD (alertes
// de transparence, sources non collectées, métriques brutes) ne sont pas
// encore sérialisés. Ils sont déclarés OPTIONNELS ci-dessous et l'UI se
// dégrade proprement quand ils sont absents — jamais de valeur inventée.

/** Verdict canonique côté front. Le backend expose deux orthographes
 *  (enum SQLAlchemy `bon_achat`, enum Pydantic « Bon achat ») : on normalise
 *  à l'entrée via `normalizeVerdict()`. */
export type Verdict = "bon_achat" | "risque" | "a_eviter";

export type AnalysisStatus =
  | "pending"
  | "in_progress"
  | "running"
  | "completed"
  | "failed"
  | "partial";

/** Un facteur explicatif issu du module d'explicabilité.
 *  `contribution > 0` = pousse le score de risque vers le haut (aggravant). */
export interface Factor {
  feature: string;
  value: number | string | boolean | null;
  contribution: number;
}

/** Les 4 alertes de transparence du PRD (§2.4.4). Purement informatives :
 *  elles n'entrent ni dans le score ni dans le verdict. */
export type AlertCode =
  | "domaine_recent"
  | "aucune_autorite"
  | "historique_discontinu"
  | "base_de_menaces";

export interface Alert {
  code: AlertCode;
  /** Message prêt à afficher. Absent → libellé par défaut du code. */
  message?: string;
}

/** Identité du domaine (DomainOut). */
export interface Domain {
  id: string;
  domain_name: string;
  tld: string | null;
  country: string | null;
  domain_length: number | null;
  hyphen_count: number | null;
  whois_creation_date: string | null;
  whois_expiration_date: string | null;
  first_analysis: string | null;
}

/** Mesures collectées (DomainMetric). Alimente le tableau des données brutes. */
export interface DomainMetric {
  rank_value: number | null;
  rank_source: string | null;
  backlink_count: number | null;
  referring_domains_count: number | null;
  nb_server_count: number | null;
  is_blacklisted: boolean | null;
}

/** Une analyse complète (AnalysisOut). */
export interface Analysis {
  id: string;
  status: AnalysisStatus | null;

  /** 0–100, bas = bon. Null quand le modèle n'a pas pu se prononcer. */
  risk_score: number | null;
  /** 0–100, haut = bon. */
  authority_score: number | null;

  verdict: Verdict | null;
  shap_values: Factor[] | null;

  requested_at: string | null;
  completed_at: string | null;

  domain: Domain | null;

  // ── Champs à venir côté backend ────────────────────────────────────────
  /** Alertes de transparence (PRD §2.4.4). */
  alerts?: Alert[];
  /** Sources qui n'ont pas répondu — affichées telles quelles à l'utilisateur. */
  missing_sources?: string[];
  /** Horodatage de la donnée quand elle provient du cache 24 h (UC-03, A4). */
  cached_at?: string | null;
  /** Mesures brutes associées. */
  metric?: DomainMetric | null;
}

/** Résultat d'une soumission : un rapport par domaine + les domaines écartés. */
export interface AnalysisBatchResult {
  results: Analysis[];
  /** Domaines dont l'analyse a échoué, avec la raison (UC-03, A7). */
  failed: { domain: string; reason: string }[];
  /** Vrai quand les rapports proviennent du jeu de démonstration. */
  demo?: boolean;
}

/** Ligne d'historique (AnalysisSummary). */
export interface AnalysisSummary {
  id: string;
  domain_name: string;
  risk_score: number | null;
  authority_score: number | null;
  verdict: Verdict | null;
  requested_at: string | null;
  status: AnalysisStatus | null;
}

export interface AnalysisPage {
  items: AnalysisSummary[];
  total: number;
  page: number;
  page_size: number;
}

/** Ramène les orthographes backend au verdict canonique. */
export function normalizeVerdict(raw: unknown): Verdict | null {
  if (typeof raw !== "string") return null;
  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .replace(/[\s_-]+/g, "_");

  if (key === "bon_achat") return "bon_achat";
  if (key === "risque") return "risque";
  if (key === "a_eviter") return "a_eviter";
  return null;
}
