import { Check } from "lucide-react";

// ponytail: terminal statique. La boucle animée (frappe, checks, compteurs) arrive au Jour 2.
const checks = [
  { label: "RDAP", value: "enregistré 2014 · expire 2027" },
  { label: "Bases de menaces", value: "absent (PhishTank, URLhaus, OpenPhish)" },
  { label: "Blacklists DNS", value: "non listé" },
  { label: "Tranco", value: "#12 480" },
  { label: "Open PageRank", value: "4.7 / 10" },
  { label: "DNS", value: "MX · SPF · DMARC ok" },
];

export default function TerminalDemo() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-3 rounded-full bg-avoid/60" />
        <span className="size-3 rounded-full bg-risky/60" />
        <span className="size-3 rounded-full bg-good/60" />
        <span className="ml-2 font-mono text-xs text-text-faint">riskly · analyse</span>
      </div>

      <div className="space-y-3 p-5 font-mono text-sm">
        <p>
          <span className="text-text-faint">$ riskly analyse </span>
          <span className="text-accent">exemple-domaine.com</span>
        </p>

        <ul className="space-y-2 pt-1">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-good" />
              <span className="w-36 shrink-0 text-text-muted">{c.label}</span>
              <span className="truncate text-text-faint">{c.value}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="rounded-lg border border-border bg-bg p-3">
            <p className="text-xs text-text-faint">Score de risque</p>
            <p className="mt-1 text-2xl text-good">
              12<span className="text-sm text-text-faint">/100</span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-bg p-3">
            <p className="text-xs text-text-faint">Score d'autorité</p>
            <p className="mt-1 text-2xl text-accent">
              72<span className="text-sm text-text-faint">/100</span>
            </p>
          </div>
        </div>

        <div className="pt-1">
          <span className="inline-block rounded-md border border-good/30 bg-good/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-good">
            Bon achat
          </span>
        </div>
      </div>
    </div>
  );
}
