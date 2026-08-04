export const MAX_WARMUP_BYTES = 5 * 1024 * 1024;

export const WARMUP_ACCEPT = ".csv,text/csv";

export interface WarmupFile {
  file: File;
  rows: number | null;
}

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
    return { file, rows: null };
  }
}

export function matchDomainByFileName(fileName: string, domains: string[]): number {
  const haystack = fileName.toLowerCase().replace(/\.csv$/, "");
  return domains.findIndex((domain) => domain.length > 0 && haystack.includes(domain));
}
