const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type DomainIssue = "empty" | "format" | "duplicate";

export function normalizeDomain(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.split(/[/?#]/)[0];
  value = value.split("@").pop() ?? value;
  value = value.replace(/:\d+$/, "");
  value = value.replace(/^www\./, "");
  value = value.replace(/\.$/, "");
  return value;
}

export function isValidDomain(value: string): boolean {
  if (value.length === 0 || value.length > 253) return false;
  const labels = value.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/.test(tld)) return false;
  return labels.every((label) => LABEL.test(label));
}

export function splitDomains(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map(normalizeDomain)
    .filter((d) => d.length > 0);
}

export function tldOf(value: string): string {
  const parts = value.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
}
