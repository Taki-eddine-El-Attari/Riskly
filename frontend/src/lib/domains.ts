// Validation et normalisation des noms de domaine saisis.
// Le format est vérifié côté client pour écarter une saisie invalide AVANT
// tout appel externe (PRD, UC-03 scénario A2) — le backend revalide de toute façon.

/** Étiquette DNS : lettres/chiffres, tirets à l'intérieur, 63 caractères max. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type DomainIssue = "empty" | "format" | "duplicate";

/**
 * Nettoie une saisie humaine : espaces, casse, schéma, `www.`, chemin, port.
 * « HTTPS://WWW.Exemple-Domaine.com/page » → « exemple-domaine.com ».
 */
export function normalizeDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // schéma
  value = value.split(/[/?#]/)[0]; // chemin, requête, ancre
  value = value.split("@").pop() ?? value; // adresse e-mail collée
  value = value.replace(/:\d+$/, ""); // port
  value = value.replace(/^www\./, "");
  value = value.replace(/\.$/, ""); // point final (FQDN absolu)
  return value;
}

/** Vrai si la chaîne normalisée est un nom de domaine syntaxiquement valide. */
export function isValidDomain(value: string): boolean {
  if (value.length === 0 || value.length > 253) return false;
  const labels = value.split(".");
  if (labels.length < 2) return false; // il faut au moins un TLD
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/.test(tld)) return false; // TLD alphabétique
  return labels.every((label) => LABEL.test(label));
}

/** Découpe un collage (virgules, espaces, retours à la ligne) en domaines. */
export function splitDomains(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map(normalizeDomain)
    .filter((d) => d.length > 0);
}

/** Le TLD d'un domaine, point compris : « exemple.co.uk » → « .uk ». */
export function tldOf(value: string): string {
  const parts = value.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
}
