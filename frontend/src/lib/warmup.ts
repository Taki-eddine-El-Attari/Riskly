// Fichier CSV de warm-up attaché à un domaine.
//
// Optionnel : l'analyse fonctionne sans. Quand il est présent, il accompagne
// le domaine dans la requête (voir api/analyses.api.ts).

/** 5 Mo : au-delà, c'est un export qui n'a rien à faire dans une analyse. */
export const MAX_WARMUP_BYTES = 5 * 1024 * 1024;

export const WARMUP_ACCEPT = ".csv,text/csv";

export interface WarmupFile {
  file: File;
  /** Nombre de lignes de données (en-tête exclu). `null` si illisible. */
  rows: number | null;
}

/** Vrai pour un CSV — l'extension prime, les navigateurs mentent sur le type. */
export function isCsvFile(file: File): boolean {
  if (file.name.toLowerCase().endsWith(".csv")) return true;
  return file.type === "text/csv" || file.type === "application/csv";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

export class WarmupError extends Error {}

/**
 * Valide le fichier et compte ses lignes, pour donner un retour immédiat
 * (« warmup.csv · 148 lignes ») plutôt qu'un simple nom de fichier.
 */
export async function readWarmupFile(file: File): Promise<WarmupFile> {
  if (!isCsvFile(file)) {
    throw new WarmupError(`« ${file.name} » n'est pas un fichier CSV.`);
  }
  if (file.size > MAX_WARMUP_BYTES) {
    throw new WarmupError(
      `« ${file.name} » dépasse ${formatBytes(MAX_WARMUP_BYTES)}.`,
    );
  }
  if (file.size === 0) {
    throw new WarmupError(`« ${file.name} » est vide.`);
  }

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return { file, rows: Math.max(0, lines.length - 1) };
  } catch {
    // Le comptage est un confort : un fichier illisible ici reste attachable.
    return { file, rows: null };
  }
}

/**
 * Associe des fichiers déposés en vrac aux domaines saisis.
 * Un fichier nommé d'après un domaine (`exemple-domaine.com.csv`,
 * `warmup_exemple-domaine.csv`) rejoint ce domaine ; les autres comblent les
 * emplacements libres dans l'ordre.
 */
export function matchFilesToDomains(
  files: File[],
  domains: string[],
  taken: boolean[],
): Map<number, File> {
  const assignment = new Map<number, File>();
  const claimed = [...taken];
  const remaining: File[] = [];

  for (const file of files) {
    const haystack = file.name.toLowerCase().replace(/\.csv$/, "");
    const index = domains.findIndex(
      (domain, i) =>
        domain.length > 0 && !claimed[i] && !assignment.has(i) && haystack.includes(domain),
    );
    if (index >= 0) {
      assignment.set(index, file);
      claimed[index] = true;
    } else {
      remaining.push(file);
    }
  }

  for (const file of remaining) {
    const index = domains.findIndex((_, i) => !claimed[i] && !assignment.has(i));
    if (index < 0) break;
    assignment.set(index, file);
    claimed[index] = true;
  }

  return assignment;
}
