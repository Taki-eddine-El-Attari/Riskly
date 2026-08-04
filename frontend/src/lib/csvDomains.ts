import { normalizeDomain } from "@/lib/domains";

export interface CsvTable {
  header: string[];
  rows: string[][];
}

const YIELD_EVERY_ROWS = 2000;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function isBlankRow(row: string[]): boolean {
  return row.length === 0 || (row.length === 1 && row[0].trim().length === 0);
}

export async function parseCsvTable(text: string): Promise<CsvTable> {
  const allRows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (char === "\r") {
      i += 1;
      continue;
    }

    if (char === "\n") {
      row.push(field);
      field = "";
      if (!isBlankRow(row)) allRows.push(row);
      row = [];
      i += 1;
      if (allRows.length % YIELD_EVERY_ROWS === 0) {
        await yieldToEventLoop();
      }
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!isBlankRow(row)) allRows.push(row);
  }

  const [header = [], ...rows] = allRows;
  return { header, rows };
}

export function findColumnIndex(header: string[], name: string): number {
  const target = name.trim().toLowerCase();
  return header.findIndex((h) => h.trim().toLowerCase() === target);
}

export interface DomainGroup {
  domain: string;
  rows: string[][];
}

export interface GroupedCsv {
  header: string[];
  hasDomainColumn: boolean;
  groups: DomainGroup[];
}

export function groupByDomain(table: CsvTable): GroupedCsv {
  const domainIdx = findColumnIndex(table.header, "domain_name");
  if (domainIdx === -1) {
    return { header: table.header, hasDomainColumn: false, groups: [] };
  }

  const order: string[] = [];
  const byDomain = new Map<string, string[][]>();

  for (const row of table.rows) {
    const domain = normalizeDomain(row[domainIdx] ?? "");
    if (domain.length === 0) continue;
    if (!byDomain.has(domain)) {
      byDomain.set(domain, []);
      order.push(domain);
    }
    byDomain.get(domain)!.push(row);
  }

  return {
    header: table.header,
    hasDomainColumn: true,
    groups: order.map((domain) => ({ domain, rows: byDomain.get(domain)! })),
  };
}

function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function buildDomainCsvFile(header: string[], rows: string[][], fileName: string): File {
  const text = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
  return new File([text], fileName, { type: "text/csv" });
}

export interface FilteredCsv {
  file: File;
  matchedRows: number;
  otherDomains: string[];
  hasDomainColumn: boolean;
}

export async function filterCsvFileForDomain(file: File, domain: string): Promise<FilteredCsv> {
  const text = await file.text();
  const table = await parseCsvTable(text);
  const grouped = groupByDomain(table);

  if (!grouped.hasDomainColumn) {
    return { file, matchedRows: table.rows.length, otherDomains: [], hasDomainColumn: false };
  }

  const target = normalizeDomain(domain);
  const matched = grouped.groups.find((g) => g.domain === target);
  const otherDomains = grouped.groups.filter((g) => g.domain !== target).map((g) => g.domain);

  return {
    file: buildDomainCsvFile(grouped.header, matched?.rows ?? [], file.name),
    matchedRows: matched?.rows.length ?? 0,
    otherDomains,
    hasDomainColumn: true,
  };
}
