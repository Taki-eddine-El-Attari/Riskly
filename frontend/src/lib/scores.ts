// Bandes de scores, verdicts et libellés d'alertes — la sémantique visuelle du
// produit, centralisée (design.md §12.2 → §12.4).
//
// Règle de couleur : le RISQUE porte l'alarme et se colore par sa bande
// (good / risky / avoid). L'AUTORITÉ reste en cyan, seule l'intensité traduit
// la force — on ne teinte jamais une autorité faible en ambre ou en rouge.
//
// Les classes Tailwind sont écrites en toutes lettres (jamais interpolées) :
// le scanner de Tailwind ne voit pas les chaînes construites à l'exécution.

import type { AlertCode, Verdict } from "@/types/analysis";

export type Tone = "good" | "risky" | "avoid" | "accent" | "faint";

export interface Band {
  label: string;
  tone: Tone;
  /** Bornes inclusives, pour l'affichage « 0–25 ». */
  min: number;
  max: number;
}

export const RISK_BANDS: Band[] = [
  { label: "Risque faible", tone: "good", min: 0, max: 25 },
  { label: "Risque modéré", tone: "risky", min: 26, max: 60 },
  { label: "Risque élevé", tone: "avoid", min: 61, max: 100 },
];

export const AUTHORITY_BANDS: Band[] = [
  { label: "Autorité faible", tone: "faint", min: 0, max: 30 },
  { label: "Autorité correcte", tone: "accent", min: 31, max: 65 },
  { label: "Autorité forte", tone: "accent", min: 66, max: 100 },
];

// Contrairement au risque, une rentabilité élevée est une bonne nouvelle :
// mêmes tons (good/risky/avoid) que le risque, mais appliqués dans l'autre
// sens (score haut → good, score bas → avoid).
export const PROFITABILITY_BANDS: Band[] = [
  { label: "Rentabilité faible", tone: "avoid", min: 0, max: 33 },
  { label: "Rentabilité moyenne", tone: "risky", min: 34, max: 66 },
  { label: "Rentabilité forte", tone: "good", min: 67, max: 100 },
];

export function riskBand(score: number): Band {
  return RISK_BANDS.find((b) => score <= b.max) ?? RISK_BANDS[RISK_BANDS.length - 1];
}

export function authorityBand(score: number): Band {
  return (
    AUTHORITY_BANDS.find((b) => score <= b.max) ??
    AUTHORITY_BANDS[AUTHORITY_BANDS.length - 1]
  );
}

export function profitabilityBand(score: number): Band {
  return (
    PROFITABILITY_BANDS.find((b) => score <= b.max) ??
    PROFITABILITY_BANDS[PROFITABILITY_BANDS.length - 1]
  );
}

// Sortie du modèle de warm-up : probabilité de réussite d'une campagne email.
// Même sens de lecture que la rentabilité (haut = bon), seuil aligné sur celui
// du modèle lui-même (0.4, cf. le bundle .pkl).
export const EMAIL_HEALTH_BANDS: Band[] = [
  { label: "Réputation fragile", tone: "avoid", min: 0, max: 39 },
  { label: "Réputation correcte", tone: "risky", min: 40, max: 69 },
  { label: "Réputation solide", tone: "good", min: 70, max: 100 },
];

export function emailHealthBand(score: number): Band {
  return (
    EMAIL_HEALTH_BANDS.find((b) => score <= b.max) ??
    EMAIL_HEALTH_BANDS[EMAIL_HEALTH_BANDS.length - 1]
  );
}

/** Opacité du tracé de la jauge d'autorité : l'intensité seule dit la force. */
export function authorityIntensity(score: number): number {
  if (score >= 66) return 1;
  if (score >= 31) return 0.7;
  return 0.4;
}

// ── Classes par ton ────────────────────────────────────────────────────────

export const toneText: Record<Tone, string> = {
  good: "text-good",
  risky: "text-risky",
  avoid: "text-avoid",
  accent: "text-accent",
  faint: "text-text-faint",
};

export const toneStroke: Record<Tone, string> = {
  good: "stroke-good",
  risky: "stroke-risky",
  avoid: "stroke-avoid",
  accent: "stroke-accent",
  faint: "stroke-text-faint",
};

export const toneBadge: Record<Tone, string> = {
  good: "border-good/30 bg-good/10 text-good",
  risky: "border-risky/30 bg-risky/10 text-risky",
  avoid: "border-avoid/30 bg-avoid/10 text-avoid",
  accent: "border-accent/30 bg-accent/10 text-accent",
  faint: "border-border bg-bg-elevated text-text-faint",
};

export const toneFill: Record<Tone, string> = {
  good: "bg-good",
  risky: "bg-risky",
  avoid: "bg-avoid",
  accent: "bg-accent",
  faint: "bg-text-faint",
};

// ── Verdicts ───────────────────────────────────────────────────────────────

export interface VerdictMeta {
  label: string;
  tone: Tone;
  /** Une phrase, en français courant, sur ce que le verdict signifie. */
  hint: string;
}

export const VERDICTS: Record<Verdict, VerdictMeta> = {
  bon_achat: {
    label: "Bon achat",
    tone: "good",
    hint: "Aucun signal de réputation compromise, et une autorité qui tient.",
  },
  risque: {
    label: "Risqué",
    tone: "risky",
    hint: "Des signaux à vérifier avant de vous engager financièrement.",
  },
  a_eviter: {
    label: "À éviter",
    tone: "avoid",
    hint: "Le niveau de risque relevé ne justifie pas l'achat.",
  },
};

/** Ordre d'affichage de la liste comparative : le meilleur en premier. */
export const VERDICT_ORDER: Verdict[] = ["bon_achat", "risque", "a_eviter"];

/**
 * Matrice de décision du PRD (§2.4.3) : risque × autorité → verdict.
 * Le risque prime — un risque élevé finit sur « À éviter » quelle que soit
 * l'autorité. Déterministe : on l'applique côté front uniquement quand le
 * backend n'a pas renvoyé de verdict, jamais pour contredire le sien.
 */
export function computeVerdict(risk: number, authority: number): Verdict {
  if (risk > 60) return "a_eviter";
  const weakAuthority = authority <= 30;
  if (risk > 25) return weakAuthority ? "a_eviter" : "risque";
  return weakAuthority ? "risque" : "bon_achat";
}

// ── Alertes de transparence ────────────────────────────────────────────────

export interface AlertMeta {
  label: string;
  /** Ce que l'alerte veut dire, sans jargon. */
  hint: string;
  tone: Tone;
}

export const ALERTS: Record<AlertCode, AlertMeta> = {
  domaine_recent: {
    label: "Domaine très récent",
    hint: "Enregistré il y a moins de 30 jours : trop jeune pour avoir un historique lisible.",
    tone: "risky",
  },
  aucune_autorite: {
    label: "Aucune autorité détectée",
    hint: "Le domaine n'apparaît dans aucun classement de popularité connu.",
    tone: "faint",
  },
  historique_discontinu: {
    label: "Historique d'usage discontinu",
    hint: "Une rupture apparaît dans les enregistrements du domaine.",
    tone: "risky",
  },
  base_de_menaces: {
    label: "Domaine présent dans une base de menaces",
    hint: "Repéré dans PhishTank, OpenPhish ou URLhaus.",
    tone: "avoid",
  },
};
