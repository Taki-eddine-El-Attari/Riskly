// Traduction des facteurs explicatifs du modèle en français courant.
//
// Contrainte produit (PRD, UC-04 + design.md §13) : AUCUN terme de science des
// données dans l'interface. On ne dit ni « SHAP », ni « feature », ni
// « contribution » — on dit ce que le signal veut dire pour un acheteur.

import type { Factor } from "@/types/analysis";

interface FeatureMeta {
  /** Libellé affiché. */
  label: string;
  /** Met la valeur brute en français lisible. */
  format?: (value: Factor["value"]) => string;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

const FEATURES: Record<string, FeatureMeta> = {
  age_domaine: {
    label: "Âge du domaine",
    format: (v) => formatAge(v),
  },
  domain_age: { label: "Âge du domaine", format: (v) => formatAge(v) },
  open_page_rank: {
    label: "Autorité du domaine",
    format: (v) => (typeof v === "number" ? `${format1(v)} / 10` : fallback(v)),
  },
  rank_value: {
    label: "Autorité du domaine",
    format: (v) => (typeof v === "number" ? `${format1(v)} / 10` : fallback(v)),
  },
  referring_domains: {
    label: "Sites qui pointent vers lui",
    format: (v) =>
      typeof v === "number"
        ? `${formatInt(v)} ${plural(v, "domaine référent", "domaines référents")}`
        : fallback(v),
  },
  backlink_count: {
    label: "Liens entrants",
    format: (v) =>
      typeof v === "number"
        ? `${formatInt(v)} ${plural(v, "lien", "liens")}`
        : fallback(v),
  },
  is_in_threat_db: {
    label: "Présence dans une base de menaces",
    format: (v) => (v ? "Oui" : "Aucune"),
  },
  is_blacklisted: {
    label: "Blacklists DNS",
    format: (v) => (v ? "Présent sur au moins une liste" : "Aucune liste"),
  },
  nbr_serv: {
    label: "Serveurs de noms déclarés",
    format: (v) =>
      typeof v === "number"
        ? `${formatInt(v)} ${plural(v, "serveur", "serveurs")}`
        : fallback(v),
  },
  nb_server_count: {
    label: "Serveurs de noms déclarés",
    format: (v) =>
      typeof v === "number"
        ? `${formatInt(v)} ${plural(v, "serveur", "serveurs")}`
        : fallback(v),
  },
  domain_len: {
    label: "Longueur du nom",
    format: (v) =>
      typeof v === "number"
        ? `${formatInt(v)} ${plural(v, "caractère", "caractères")}`
        : fallback(v),
  },
  nbr_hyp: {
    label: "Tirets dans le nom",
    format: (v) =>
      typeof v === "number"
        ? v === 0
          ? "Aucun"
          : `${formatInt(v)} ${plural(v, "tiret", "tirets")}`
        : fallback(v),
  },
  tld: {
    label: "Extension",
    format: (v) => (typeof v === "string" ? (v.startsWith(".") ? v : `.${v}`) : fallback(v)),
  },
  country: {
    label: "Pays d'hébergement",
    format: (v) => (typeof v === "string" && v.length > 0 ? v.toUpperCase() : fallback(v)),
  },
  tranco_rank: {
    label: "Classement de popularité",
    format: (v) => (typeof v === "number" ? `${formatInt(v)}ᵉ` : fallback(v)),
  },
};

function format1(v: number): string {
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function formatInt(v: number): string {
  return Math.round(v).toLocaleString("fr-FR");
}

function fallback(v: Factor["value"]): string {
  if (v === null || v === undefined || v === "") return "Non collecté";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "number") return format1(v);
  return String(v);
}

function formatAge(v: Factor["value"]): string {
  if (typeof v !== "number") return fallback(v);
  // Le backend peut exprimer l'âge en jours comme en années : au-delà de
  // 100, on considère qu'il s'agit de jours.
  const days = v > 100 ? v : v * 365;
  const years = Math.floor(days / 365);
  if (years >= 1) return `${years} ${plural(years, "an", "ans")}`;
  const months = Math.floor(days / 30);
  if (months >= 1) return `${months} mois`;
  const d = Math.max(0, Math.round(days));
  return `${d} ${plural(d, "jour", "jours")}`;
}

/** Libellé lisible d'un signal, avec repli sur une humanisation du nom brut. */
export function factorLabel(feature: string): string {
  const meta = FEATURES[feature.toLowerCase()];
  if (meta) return meta.label;
  const words = feature.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Valeur du signal, formatée en français. */
export function factorValue(factor: Factor): string {
  const meta = FEATURES[factor.feature.toLowerCase()];
  return meta?.format ? meta.format(factor.value) : fallback(factor.value);
}

/** Sens de la contribution, formulé pour un non-technicien. */
export function factorDirection(contribution: number): {
  label: string;
  tone: "avoid" | "good";
} {
  return contribution > 0
    ? { label: "augmente le risque", tone: "avoid" }
    : { label: "diminue le risque", tone: "good" };
}

/** Trie les facteurs du plus influent au moins influent. */
export function sortFactors(factors: Factor[]): Factor[] {
  return [...factors].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );
}

// ── Lecture en jauge ───────────────────────────────────────────────────────

export interface FactorGauge {
  /** Remplissage de l'arc, 0 à 1. Repère visuel uniquement. */
  ratio: number;
  /** Le chiffre, court, au centre de la jauge. */
  value: string;
  /** Son unité, sous le chiffre. */
  unit: string;
  /**
   * Signal sans échelle (présence/absence, extension) : l'arc est plein et la
   * couleur seule porte le sens — tout vert ou tout rouge selon la direction.
   */
  full?: boolean;
}

/**
 * Signaux binaires ou catégoriels : pas d'échelle, donc pas de remplissage
 * partiel. On affiche un état court au centre et l'arc reste plein — le sens
 * vient de la couleur (direction du facteur).
 */
const CATEGORICAL: Record<string, (value: Factor["value"]) => { value: string; unit: string }> = {
  is_in_threat_db: (v) => ({ value: v ? "Trouvé" : "Aucune", unit: "menace" }),
  is_blacklisted: (v) => ({ value: v ? "Listé" : "Aucune", unit: "blacklist" }),
  tld: (v) => ({
    value: typeof v === "string" ? (v.startsWith(".") ? v : `.${v}`) : "—",
    unit: "extension",
  }),
};

/** Échelles d'affichage : jusqu'où l'arc doit être plein. */
const SCALES: Record<string, { max: number; log?: boolean; unit: string }> = {
  open_page_rank: { max: 10, unit: "/ 10" },
  rank_value: { max: 10, unit: "/ 10" },
  referring_domains: { max: 5000, log: true, unit: "sites" },
  backlink_count: { max: 20000, log: true, unit: "liens" },
  nbr_serv: { max: 6, unit: "serveurs" },
  nb_server_count: { max: 6, unit: "serveurs" },
  domain_len: { max: 30, unit: "caractères" },
  nbr_hyp: { max: 5, unit: "tirets" },
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Traduit un signal en jauge.
 *
 * Pour un signal CHIFFRÉ, l'arc est un repère visuel — il situe la valeur sur
 * une échelle d'affichage (10 ans pour l'âge, 5 000 domaines référents…) — et
 * c'est le chiffre au centre qui fait foi. Pour un signal SANS ÉCHELLE (présence
 * en base de menaces, blacklist, extension), l'arc est plein : la couleur seule
 * porte le sens, tout vert ou tout rouge selon la direction du facteur.
 * Renvoie `null` uniquement pour un signal inconnu, qui retombe en pastille.
 */
export function factorGauge(factor: Factor): FactorGauge | null {
  const key = factor.feature.toLowerCase();

  if (key === "age_domaine" || key === "domain_age") {
    if (typeof factor.value !== "number") return null;
    const days = factor.value > 100 ? factor.value : factor.value * 365;
    const years = days / 365;
    return {
      ratio: clamp01(years / 10), // 10 ans = arc plein
      value:
        years >= 1
          ? String(Math.floor(years))
          : String(Math.max(0, Math.round(days / 30))),
      unit: years >= 1 ? (years >= 2 ? "ans" : "an") : "mois",
    };
  }

  const categorical = CATEGORICAL[key];
  if (categorical) {
    return { ratio: 1, full: true, ...categorical(factor.value) };
  }

  const scale = SCALES[key];
  if (!scale || typeof factor.value !== "number") return null;

  const ratio = scale.log
    ? clamp01(Math.log10(1 + factor.value) / Math.log10(1 + scale.max))
    : clamp01(factor.value / scale.max);

  return {
    ratio,
    value: factor.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 }),
    unit: scale.unit,
  };
}
