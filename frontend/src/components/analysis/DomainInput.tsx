import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, Globe, Loader2, Plus, X } from "lucide-react";
import { BorderBeam } from "@/components/landing/effects/BorderBeam";
import { useTypingPlaceholder } from "@/hooks/useTypingPlaceholder";
import { MAX_DOMAINS } from "@/lib/constants";
import { isValidDomain, normalizeDomain, splitDomains } from "@/lib/domains";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "exemple-domaine.com",
  "boutique-mode.fr",
  "crypto-invest.io",
  "agence-web.ma",
];

interface Row {
  id: number;
  value: string;
}

type RowIssue = "format" | "duplicate" | null;

let nextId = 1;
const newRow = (value = ""): Row => ({ id: nextId++, value });

/**
 * Saisie de 1 à 5 domaines.
 *
 * Le premier champ reprend exactement le champ du hero de la landing (coque
 * arrondie, lueur de bordure, placeholder qui se tape) : l'utilisateur qui
 * arrive de la vitrine retrouve le même geste après connexion. Les domaines
 * suivants s'ajoutent en lignes compactes en dessous.
 *
 * Le format est validé au fil de l'eau et les doublons sont signalés — un
 * domaine invalide est écarté sans bloquer les autres (PRD, UC-03 A2/A3).
 */
export function DomainInput({
  onSubmit,
  pending = false,
  className,
}: {
  onSubmit: (domains: string[]) => void;
  pending?: boolean;
  className?: string;
}) {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [focused, setFocused] = useState(false);
  const inputRefs = useRef(new Map<number, HTMLInputElement>());

  const typed = useTypingPlaceholder(EXAMPLES, focused || rows[0].value.length > 0);

  const registerRef = useCallback((id: number, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(id, el);
    else inputRefs.current.delete(id);
  }, []);

  /** Domaines normalisés, dans l'ordre de saisie — sert au diagnostic des lignes. */
  const normalized = useMemo(() => rows.map((r) => normalizeDomain(r.value)), [rows]);

  const issues = useMemo<RowIssue[]>(
    () =>
      normalized.map((value, i) => {
        if (value.length === 0) return null;
        if (!isValidDomain(value)) return "format";
        if (normalized.indexOf(value) < i) return "duplicate";
        return null;
      }),
    [normalized],
  );

  const validDomains = useMemo(
    () => normalized.filter((value, i) => value.length > 0 && issues[i] === null),
    [normalized, issues],
  );

  const canAddRow = rows.length < MAX_DOMAINS;

  function setValue(id: number, value: string) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, value } : r)));
  }

  function removeRow(id: number) {
    setRows((current) => (current.length === 1 ? [newRow()] : current.filter((r) => r.id !== id)));
  }

  function addRow() {
    if (!canAddRow) return;
    const row = newRow();
    setRows((current) => [...current, row]);
    // Le champ n'existe qu'au rendu suivant.
    requestAnimationFrame(() => inputRefs.current.get(row.id)?.focus());
  }

  /**
   * Coller une liste (« a.com, b.fr b.io ») remplit les lignes suivantes
   * plutôt que de tout entasser dans un seul champ.
   */
  function handlePaste(id: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = splitDomains(event.clipboardData.getData("text"));
    if (pasted.length < 2) return;
    event.preventDefault();

    setRows((current) => {
      const index = current.findIndex((r) => r.id === id);
      const before = current.slice(0, index);
      const after = current.slice(index + 1);
      const inserted = pasted.map((d) => newRow(d));
      return [...before, ...inserted, ...after].slice(0, MAX_DOMAINS);
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || validDomains.length === 0) return;
    onSubmit(validDomains);
  }

  return (
    <form onSubmit={submit} className={cn("w-full", className)} noValidate>
      {/* Champ principal — identique au hero de la landing. */}
      <div className="relative w-full rounded-2xl border border-border bg-bg-elevated/80 p-2 shadow-2xl backdrop-blur transition-colors focus-within:border-accent/60">
        <BorderBeam size={120} duration={7} />
        <div className="flex items-center gap-3 px-3">
          <Globe className="size-5 shrink-0 text-text-faint" aria-hidden />
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <input
              ref={(el) => registerRef(rows[0].id, el)}
              value={rows[0].value}
              onChange={(e) => setValue(rows[0].id, e.target.value)}
              onPaste={(e) => handlePaste(rows[0].id, e)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label="Nom de domaine à analyser"
              aria-invalid={issues[0] !== null}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
              className="w-full bg-transparent py-4 font-mono text-base text-text outline-none disabled:opacity-60"
            />
            {rows[0].value === "" && (
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center font-mono text-base text-text-faint">
                {typed}
                <span className="typing-caret ml-0.5 h-5 w-px bg-accent" />
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={pending || validDomains.length === 0}
            aria-label="Analyser"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-3 font-medium text-bg outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50 sm:px-5"
          >
            <span className="hidden sm:inline">
              {pending
                ? "Analyse…"
                : validDomains.length > 1
                  ? `Analyser ${validDomains.length} domaines`
                  : "Analyser"}
            </span>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <RowFeedback issue={issues[0]} className="px-3" />

      {/* Domaines 2 à 5. */}
      {rows.length > 1 && (
        <ul className="mt-3 space-y-2">
          {rows.slice(1).map((row) => {
            const index = rows.findIndex((r) => r.id === row.id);
            return (
              <li key={row.id}>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated/60 px-4 transition-colors focus-within:border-accent/60">
                  <Globe className="size-4 shrink-0 text-text-faint" aria-hidden />
                  <input
                    ref={(el) => registerRef(row.id, el)}
                    value={row.value}
                    onChange={(e) => setValue(row.id, e.target.value)}
                    onPaste={(e) => handlePaste(row.id, e)}
                    aria-label={`Domaine ${index + 1}`}
                    aria-invalid={issues[index] !== null}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={pending}
                    placeholder="autre-domaine.com"
                    className="w-full min-w-0 flex-1 bg-transparent py-3 font-mono text-sm text-text outline-none placeholder:text-text-faint disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={pending}
                    aria-label={`Retirer le domaine ${index + 1}`}
                    className="shrink-0 rounded-md p-1.5 text-text-faint outline-none transition-colors hover:bg-bg-elevated hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:opacity-50"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <RowFeedback issue={issues[index]} className="px-4" />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <button
          type="button"
          onClick={addRow}
          disabled={!canAddRow || pending}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-muted outline-none transition-colors duration-150 hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden />
          Ajouter un domaine
        </button>

        <p className="font-mono text-xs text-text-faint">
          {rows.length} / {MAX_DOMAINS}
          <span className="hidden sm:inline"> · verdict en moins de 15 secondes par domaine</span>
        </p>
      </div>
    </form>
  );
}

function RowFeedback({ issue, className }: { issue: RowIssue; className?: string }) {
  if (!issue) return null;
  return (
    <p className={cn("mt-1.5 text-xs text-avoid", className)} role="alert">
      {issue === "format"
        ? "Ce nom de domaine n'a pas un format valide — il sera écarté."
        : "Ce domaine est déjà dans la liste : il ne sera analysé qu'une fois."}
    </p>
  );
}
