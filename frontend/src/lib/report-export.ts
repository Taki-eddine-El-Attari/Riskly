// Export des rapports : PDF (document à archiver ou transmettre) et CSV
// (tableau comparatif réexploitable dans un tableur).
//
// jsPDF est chargé en import dynamique : il ne pèse sur le bundle que le jour
// où l'utilisateur clique réellement sur « Télécharger ».

import { authorityBand, riskBand, VERDICTS } from "./scores";
import { ALERTS } from "./scores";
import { factorLabel, factorValue, sortFactors } from "./factors";
import { formatBytes } from "./warmup";
import type { Analysis } from "@/types/analysis";

// ── Utilitaires ────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Laisser au navigateur le temps de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Nom de fichier d'un export, sans extension. */
export function exportBaseName(analyses: Analysis[]): string {
  if (analyses.length === 1) {
    return `riskly-${slug(analyses[0].domain?.domain_name ?? "rapport")}-${today()}`;
  }
  return `riskly-analyse-${analyses.length}-domaines-${today()}`;
}

function domainName(analysis: Analysis): string {
  return analysis.domain?.domain_name ?? "domaine inconnu";
}

function score(value: number | null): string {
  return value === null ? "" : String(Math.round(value));
}

function bandLabel(analysis: Analysis, kind: "risk" | "authority"): string {
  const value = kind === "risk" ? analysis.risk_score : analysis.authority_score;
  if (value === null) return "";
  return kind === "risk" ? riskBand(value).label : authorityBand(value).label;
}

function verdictLabel(analysis: Analysis): string {
  return analysis.verdict ? VERDICTS[analysis.verdict].label : "Sans verdict";
}

function alertLabels(analysis: Analysis): string[] {
  return (analysis.alerts ?? []).map((a) => ALERTS[a.code]?.label ?? a.code);
}

/** « warmup.csv (12 Ko, 148 lignes) » — vide si aucun fichier joint. */
function warmupText(analysis: Analysis): string {
  const w = analysis.warmup;
  if (!w) return "";
  const parts = [formatBytes(w.size)];
  if (typeof w.rows === "number") parts.push(`${w.rows} lignes`);
  return `${w.name} (${parts.join(", ")})`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── CSV ────────────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  "Domaine",
  "Score de risque",
  "Niveau de risque",
  "Score d'autorite",
  "Niveau d'autorite",
  "Verdict",
  "Signaux",
  "Extension",
  "Enregistre le",
  "Expire le",
  "Pays",
  "Autorite (Open PageRank)",
  "Domaines referents",
  "Serveurs de noms",
  "Blacklists DNS",
  "Sources non collectees",
  "Fichier de warm-up",
  "Taille du warm-up",
  "Lignes du warm-up",
  "Date d'analyse",
] as const;

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(analysis: Analysis): string[] {
  const { domain, metric } = analysis;
  return [
    domainName(analysis),
    score(analysis.risk_score),
    bandLabel(analysis, "risk"),
    score(analysis.authority_score),
    bandLabel(analysis, "authority"),
    verdictLabel(analysis),
    alertLabels(analysis).join(" | "),
    domain?.tld ?? "",
    formatDate(domain?.whois_creation_date),
    formatDate(domain?.whois_expiration_date),
    domain?.country ?? "",
    metric?.rank_value !== null && metric?.rank_value !== undefined
      ? String(metric.rank_value)
      : "",
    metric?.referring_domains_count !== null && metric?.referring_domains_count !== undefined
      ? String(metric.referring_domains_count)
      : "",
    metric?.nb_server_count !== null && metric?.nb_server_count !== undefined
      ? String(metric.nb_server_count)
      : "",
    typeof metric?.is_blacklisted === "boolean"
      ? metric.is_blacklisted
        ? "Present"
        : "Aucune liste"
      : "",
    (analysis.missing_sources ?? []).join(" | "),
    analysis.warmup?.name ?? "",
    analysis.warmup ? formatBytes(analysis.warmup.size) : "",
    typeof analysis.warmup?.rows === "number" ? String(analysis.warmup.rows) : "",
    formatDate(analysis.requested_at),
  ];
}

/** Tableau comparatif, séparateur `;` (Excel francophone) et BOM UTF-8. */
export function analysesToCsv(analyses: Analysis[]): string {
  const lines = [
    CSV_COLUMNS.join(";"),
    ...analyses.map((a) => csvRow(a).map(csvCell).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function exportCsv(analyses: Analysis[]) {
  const blob = new Blob([analysesToCsv(analyses)], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${exportBaseName(analyses)}.csv`);
}

// ── PDF ────────────────────────────────────────────────────────────────────

// Palette du thème clair : c'est celle qui tient le contraste sur papier.
const INK = {
  text: "#0D1220",
  muted: "#565D73",
  faint: "#868DA0",
  border: "#E4E7EC",
  accent: "#0E7490",
  good: "#047857",
  risky: "#B45309",
  avoid: "#DC2626",
} as const;

const TONE_INK: Record<string, string> = {
  good: INK.good,
  risky: INK.risky,
  avoid: INK.avoid,
  accent: INK.accent,
  faint: INK.faint,
};

const PAGE = { width: 210, height: 297, margin: 18 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

type Doc = import("jspdf").jsPDF;

/**
 * Écrit du texte dans le document.
 *
 * Les polices standard de jsPDF n'encodent que du Latin-1 : les espaces fines
 * insécables produites par `toLocaleString("fr-FR")` (« 2 656 ») et les
 * apostrophes typographiques y sortent en caractères parasites. On les ramène
 * donc à leurs équivalents ASCII au moment de l'écriture — un seul endroit à
 * tenir plutôt qu'un formatage spécial à chaque appel.
 */
function write(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  options?: Parameters<Doc["text"]>[3],
) {
  const latin1 = text
    .replace(/[\u00a0\u2007\u2009\u202f]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");
  doc.text(latin1, x, y, options);
}

function pageFooter(doc: Doc, page: number, total: number) {
  doc.setDrawColor(INK.border);
  doc.line(PAGE.margin, PAGE.height - 16, PAGE.width - PAGE.margin, PAGE.height - 16);
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(INK.faint);
  write(
    doc,
    "Riskly - aide a la decision. Un risque faible signifie « aucun signal negatif detecte », pas « domaine sain ».",
    PAGE.margin,
    PAGE.height - 11,
  );
  write(doc, `${page} / ${total}`, PAGE.width - PAGE.margin, PAGE.height - 11, { align: "right" });
}

function pageHeader(doc: Doc, subtitle: string) {
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(INK.text);
  write(doc, "RISKLY", PAGE.margin, PAGE.margin);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(INK.faint);
  write(doc, subtitle, PAGE.width - PAGE.margin, PAGE.margin, { align: "right" });
  doc.setDrawColor(INK.border);
  doc.line(PAGE.margin, PAGE.margin + 3, PAGE.width - PAGE.margin, PAGE.margin + 3);
}

/** Pavé de verdict : rectangle teinté + libellé, comme le badge de l'interface. */
function verdictChip(doc: Doc, analysis: Analysis, x: number, y: number) {
  const label = verdictLabel(analysis).toUpperCase();
  const tone = analysis.verdict ? VERDICTS[analysis.verdict].tone : "faint";
  const color = TONE_INK[tone] ?? INK.faint;

  doc.setFont("courier", "bold").setFontSize(9);
  const width = doc.getTextWidth(label) + 6;
  doc.setDrawColor(color).setLineWidth(0.3);
  doc.roundedRect(x, y - 4.2, width, 6.5, 1, 1, "S");
  doc.setTextColor(color);
  write(doc, label, x + 3, y);
  doc.setLineWidth(0.2);
}

function scoreBlock(
  doc: Doc,
  x: number,
  y: number,
  caption: string,
  value: number | null,
  band: string,
  color: string,
) {
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(INK.faint);
  write(doc, caption.toUpperCase(), x, y);
  doc.setFont("courier", "bold").setFontSize(20).setTextColor(color);
  write(doc, value === null ? "--" : String(Math.round(value)), x, y + 9);
  doc.setFont("courier", "normal").setFontSize(8).setTextColor(INK.faint);
  write(doc, "/ 100", x + 16, y + 9);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(color);
  write(doc, band || "Non calcule", x, y + 15);
}

/** Écrit une section « libellé : valeur » sur deux colonnes alignées. */
function dataTable(doc: Doc, x: number, y: number, width: number, rows: [string, string][]): number {
  let cursor = y;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(INK.muted);
    write(doc, label, x, cursor);
    doc.setFont("courier", "normal").setFontSize(8).setTextColor(value ? INK.text : INK.faint);
    write(doc, value || "Non collecte", x + width, cursor, { align: "right" });
    doc.setDrawColor(INK.border);
    doc.line(x, cursor + 1.8, x + width, cursor + 1.8);
    cursor += 6;
  }
  return cursor;
}

function sectionTitle(doc: Doc, x: number, y: number, title: string) {
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(INK.faint);
  write(doc, title.toUpperCase(), x, y);
}

function renderReportPage(doc: Doc, analysis: Analysis) {
  pageHeader(doc, `Rapport d'analyse - ${formatDate(analysis.requested_at) || today()}`);

  let y = PAGE.margin + 14;

  doc.setFont("courier", "bold").setFontSize(16).setTextColor(INK.text);
  write(doc, domainName(analysis), PAGE.margin, y);
  verdictChip(doc, analysis, PAGE.margin + doc.getTextWidth(domainName(analysis)) + 6, y);

  y += 8;
  if (analysis.verdict) {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(INK.muted);
    write(doc, VERDICTS[analysis.verdict].hint, PAGE.margin, y);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(INK.muted);
    write(
    doc,
      "Aucun score n'a pu etre produit pour ce domaine.",
      PAGE.margin,
      y,
    );
  }

  // Scores
  y += 10;
  const riskColor =
    analysis.risk_score === null ? INK.faint : TONE_INK[riskBand(analysis.risk_score).tone];
  scoreBlock(doc, PAGE.margin, y, "Score de risque", analysis.risk_score, bandLabel(analysis, "risk"), riskColor);
  scoreBlock(
    doc,
    PAGE.margin + 60,
    y,
    "Score d'autorite",
    analysis.authority_score,
    bandLabel(analysis, "authority"),
    INK.accent,
  );

  y += 26;

  // Facteurs explicatifs
  const factors = sortFactors(analysis.shap_values ?? []).slice(0, 8);
  if (factors.length > 0) {
    sectionTitle(doc, PAGE.margin, y, "Ce qui a pese dans le score");
    y += 5;
    for (const factor of factors) {
      const raisesRisk = factor.contribution > 0;
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(INK.text);
      write(doc, factorLabel(factor.feature), PAGE.margin, y);
      doc.setFont("courier", "normal").setFontSize(8).setTextColor(INK.muted);
      write(doc, factorValue(factor), PAGE.margin + 78, y);
      doc.setFont("helvetica", "normal").setFontSize(7);
      doc.setTextColor(raisesRisk ? INK.avoid : INK.good);
      write(
    doc,
        raisesRisk ? "augmente le risque" : "diminue le risque",
        PAGE.margin + CONTENT_WIDTH,
        y,
        { align: "right" },
      );
      doc.setDrawColor(INK.border);
      doc.line(PAGE.margin, y + 1.8, PAGE.margin + CONTENT_WIDTH, y + 1.8);
      y += 6;
    }
    y += 4;
  }

  // Alertes
  const alerts = analysis.alerts ?? [];
  if (alerts.length > 0) {
    sectionTitle(doc, PAGE.margin, y, "Signaux a connaitre");
    y += 5;
    for (const alert of alerts) {
      const meta = ALERTS[alert.code];
      if (!meta) continue;
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(TONE_INK[meta.tone] ?? INK.text);
      write(doc, `- ${alert.message ?? meta.label}`, PAGE.margin, y);
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(INK.muted);
      write(doc, meta.hint, PAGE.margin + 4, y + 4);
      y += 9;
    }
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(INK.faint);
    write(
    doc,
      "Ces signaux n'entrent ni dans le score ni dans le verdict.",
      PAGE.margin,
      y,
    );
    y += 8;
  }

  // Données collectées
  const { domain, metric } = analysis;
  sectionTitle(doc, PAGE.margin, y, "Donnees collectees");
  y += 5;
  y = dataTable(doc, PAGE.margin, y, CONTENT_WIDTH, [
    ["Extension", domain?.tld ?? ""],
    [
      "Longueur du nom",
      typeof domain?.domain_length === "number" ? `${domain.domain_length} caracteres` : "",
    ],
    ["Tirets", typeof domain?.hyphen_count === "number" ? String(domain.hyphen_count) : ""],
    ["Enregistre le", formatDate(domain?.whois_creation_date)],
    ["Expire le", formatDate(domain?.whois_expiration_date)],
    ["Pays d'hebergement", domain?.country ?? ""],
    [
      "Autorite (Open PageRank)",
      typeof metric?.rank_value === "number" ? `${metric.rank_value} / 10` : "",
    ],
    [
      "Domaines referents",
      typeof metric?.referring_domains_count === "number"
        ? metric.referring_domains_count.toLocaleString("fr-FR")
        : "",
    ],
    [
      "Serveurs de noms",
      typeof metric?.nb_server_count === "number" ? String(metric.nb_server_count) : "",
    ],
    [
      "Blacklists DNS",
      typeof metric?.is_blacklisted === "boolean"
        ? metric.is_blacklisted
          ? "Present sur au moins une liste"
          : "Aucune liste"
        : "",
    ],
  ]);

  if (analysis.warmup) {
    y += 4;
    sectionTitle(doc, PAGE.margin, y, "Fichier de warm-up fourni");
    y += 5;
    doc.setFont("courier", "normal").setFontSize(8).setTextColor(INK.text);
    write(doc, warmupText(analysis), PAGE.margin, y);
    y += 6;
  }

  const missing = analysis.missing_sources ?? [];
  if (missing.length > 0) {
    y += 4;
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(INK.muted);
    write(
    doc,
      `Analyse produite sans ${missing.join(", ")} : le score repose sur une information partielle.`,
      PAGE.margin,
      y,
    );
  }
}

/** Page de synthèse d'un lot : le tableau comparatif, trié par risque croissant. */
function renderSummaryPage(doc: Doc, analyses: Analysis[]) {
  pageHeader(doc, `Analyse de ${analyses.length} domaines - ${today()}`);

  let y = PAGE.margin + 14;
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(INK.text);
  write(doc, "Synthese comparative", PAGE.margin, y);

  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(INK.muted);
  write(doc, "Domaines tries par score de risque croissant.", PAGE.margin, y);

  y += 10;
  const cols = { domain: PAGE.margin, risk: PAGE.margin + 82, authority: PAGE.margin + 108, verdict: PAGE.margin + 134 };
  doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(INK.faint);
  write(doc, "DOMAINE", cols.domain, y);
  write(doc, "RISQUE", cols.risk, y);
  write(doc, "AUTORITE", cols.authority, y);
  write(doc, "VERDICT", cols.verdict, y);
  doc.setDrawColor(INK.border);
  doc.line(PAGE.margin, y + 2, PAGE.margin + CONTENT_WIDTH, y + 2);
  y += 8;

  for (const analysis of analyses) {
    const tone = analysis.verdict ? VERDICTS[analysis.verdict].tone : "faint";
    doc.setFont("courier", "normal").setFontSize(9).setTextColor(INK.text);
    write(doc, domainName(analysis).slice(0, 34), cols.domain, y);
    doc.setTextColor(
      analysis.risk_score === null ? INK.faint : TONE_INK[riskBand(analysis.risk_score).tone],
    );
    write(doc, analysis.risk_score === null ? "--" : String(Math.round(analysis.risk_score)), cols.risk, y);
    doc.setTextColor(INK.accent);
    write(
    doc,
      analysis.authority_score === null ? "--" : String(Math.round(analysis.authority_score)),
      cols.authority,
      y,
    );
    doc.setFont("courier", "bold").setFontSize(8).setTextColor(TONE_INK[tone] ?? INK.faint);
    write(doc, verdictLabel(analysis).toUpperCase(), cols.verdict, y);

    const alerts = alertLabels(analysis);
    if (alerts.length > 0) {
      doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(INK.muted);
      write(doc, alerts.join("  -  "), cols.domain, y + 4);
    }

    doc.setDrawColor(INK.border);
    doc.line(PAGE.margin, y + 6.5, PAGE.margin + CONTENT_WIDTH, y + 6.5);
    y += alerts.length > 0 ? 13 : 11;
  }

  y += 4;
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(INK.faint);
  write(
    doc,
    "Le detail de chaque domaine figure sur les pages suivantes.",
    PAGE.margin,
    y,
  );
}

/** Génère le PDF : synthèse comparative si lot, puis une page par domaine. */
export async function exportPdf(analyses: Analysis[]) {
  if (analyses.length === 0) return;

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as Doc;
  doc.setLineWidth(0.2);

  const withSummary = analyses.length > 1;
  const totalPages = analyses.length + (withSummary ? 1 : 0);
  let page = 0;

  if (withSummary) {
    renderSummaryPage(doc, analyses);
    pageFooter(doc, ++page, totalPages);
  }

  for (const analysis of analyses) {
    if (page > 0) doc.addPage();
    renderReportPage(doc, analysis);
    pageFooter(doc, ++page, totalPages);
  }

  doc.setProperties({
    title:
      analyses.length === 1
        ? `Riskly - ${domainName(analyses[0])}`
        : `Riskly - analyse de ${analyses.length} domaines`,
    creator: "Riskly",
  });

  downloadBlob(doc.output("blob"), `${exportBaseName(analyses)}.pdf`);
}
