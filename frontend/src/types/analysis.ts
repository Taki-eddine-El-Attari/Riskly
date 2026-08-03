
export type Verdict = "bon_achat" | "risque" | "a_eviter";

export type AnalysisStatus =
  | "pending"
  | "in_progress"
  | "running"
  | "completed"
  | "failed"
  | "partial";


export interface Factor {
  feature: string;
  value: number | string | boolean | null;
  contribution: number;
}


export type AlertCode =
  | "domaine_recent"
  | "aucune_autorite"
  | "historique_discontinu"
  | "base_de_menaces";

export interface Alert {
  code: AlertCode;
  message?: string;
}

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

/** Métadonnées du CSV de warm-up fourni à l'analyse (jamais son contenu). */
export interface WarmupInfo {
  /** Nom du fichier tel que fourni par l'utilisateur. */
  name: string;
  /** Taille en octets. */
  size: number;
  /** Lignes de données (en-tête exclu). `null` si le comptage a échoué. */
  rows: number | null;
}

export interface DomainMetric {
  rank_value: number | null;
  rank_source: string | null;
  backlink_count: number | null;
  referring_domains_count: number | null;
  nb_server_count: number | null;
  is_blacklisted: boolean | null;
}

export interface Analysis {
  id: string;
  status: AnalysisStatus | null;

  risk_score: number | null;
  authority_score: number | null;
  /** Score global de rentabilite/reussite d'un warm-up (0-100). */
  profitability_score: number | null;
  /**
   * Sortie brute du modele de warm-up (0-100). `null` quand aucun CSV n'a ete
   * fourni : le modele n'a pas tourne du tout — a ne pas confondre avec 0.
   */
  email_health_score: number | null;

  verdict: Verdict | null;
  shap_values: Factor[] | null;

  requested_at: string | null;
  completed_at: string | null;

  domain: Domain | null;

  // ── backend soon ────────────────────────────────────────
  alerts?: Alert[];
  missing_sources?: string[];
  cached_at?: string | null;
  metric?: DomainMetric | null;
  /** CSV de warm-up joint à la demande, s'il y en a un. */
  warmup?: WarmupInfo | null;
}

export interface AnalysisBatchResult {
  results: Analysis[];
  failed: { domain: string; reason: string }[];
}

export interface AnalysisSummary {
  id: string;
  domain_name: string;
  risk_score: number | null;
  authority_score: number | null;
  profitability_score: number | null;
  email_health_score: number | null;
  verdict: Verdict | null;
  requested_at: string | null;
  status: AnalysisStatus | null;
  /** CSV de warm-up joint à la demande, s'il y en a un. */
  warmup?: WarmupInfo | null;
}

export interface AnalysisPage {
  items: AnalysisSummary[];
  total: number;
  page: number;
  page_size: number;
}

export function normalizeVerdict(raw: unknown): Verdict | null {
  if (typeof raw !== "string") return null;
  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]+/g, "_");

  if (key === "bon_achat") return "bon_achat";
  if (key === "risque") return "risque";
  if (key === "a_eviter") return "a_eviter";
  return null;
}
