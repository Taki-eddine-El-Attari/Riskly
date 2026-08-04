import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  FileSpreadsheet,
  Globe,
  Loader2,
  Paperclip,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { BorderBeam } from "@/components/landing/effects/BorderBeam";
import { CsvBulkImportDialog } from "@/components/analysis/CsvBulkImportDialog";
import { CsvPreviewDialog } from "@/components/analysis/CsvPreviewDialog";
import { useTypingPlaceholder } from "@/hooks/useTypingPlaceholder";
import type { BulkDomainJob } from "@/hooks/useBulkAnalyses";
import { MAX_DOMAINS } from "@/lib/constants";
import { isValidDomain, normalizeDomain, splitDomains } from "@/lib/domains";
import { buildDomainCsvFile, groupByDomain, parseCsvTable, type GroupedCsv } from "@/lib/csvDomains";
import { formatBytes, readWarmupFile, WARMUP_ACCEPT, WarmupError } from "@/lib/warmup";
import type { WarmupFile } from "@/lib/warmup";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "exemple-domaine.com",
  "boutique-mode.fr",
  "crypto-invest.io",
  "agence-web.ma",
];

export interface DomainEntry {
  domain: string;
  warmup?: WarmupFile;
}

interface Row {
  id: number;
  value: string;
  warmup?: WarmupFile;
}

type RowIssue = "format" | "duplicate" | null;

interface EffectiveWarmup {
  file: File;
  otherDomains: string[];
  matchedRows: number;
}

function effectiveWarmupFor(
  rowId: number,
  domain: string,
  warmup: WarmupFile | undefined,
  csvTables: Map<number, GroupedCsv>,
): EffectiveWarmup | undefined {
  if (!warmup) return undefined;
  const grouped = csvTables.get(rowId);
  if (!grouped || !grouped.hasDomainColumn) {
    return { file: warmup.file, otherDomains: [], matchedRows: warmup.rows ?? 0 };
  }

  const target = normalizeDomain(domain);
  const matched = grouped.groups.find((g) => g.domain === target);
  const otherDomains = grouped.groups.filter((g) => g.domain !== target).map((g) => g.domain);

  return {
    file: buildDomainCsvFile(grouped.header, matched?.rows ?? [], warmup.file.name),
    otherDomains,
    matchedRows: matched?.rows.length ?? 0,
  };
}

let nextId = 1;
const newRow = (value = ""): Row => ({ id: nextId++, value });
export function DomainInput({
  onSubmit,
  onBulkImport,
  pending = false,
  className,
}: {
  onSubmit: (entries: DomainEntry[]) => void;
  onBulkImport?: (jobs: BulkDomainJob[]) => void;
  pending?: boolean;
  className?: string;
}) {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [csvTables, setCsvTables] = useState<Map<number, GroupedCsv>>(new Map());
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const inputRefs = useRef(new Map<number, HTMLInputElement>());
  const fileRefs = useRef(new Map<number, HTMLInputElement>());
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);

  const typed = useTypingPlaceholder(EXAMPLES, focused || rows[0].value.length > 0);

  const registerRef = useCallback((id: number, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(id, el);
    else inputRefs.current.delete(id);
  }, []);

  const registerFileRef = useCallback((id: number, el: HTMLInputElement | null) => {
    if (el) fileRefs.current.set(id, el);
    else fileRefs.current.delete(id);
  }, []);

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

  const entries = useMemo<DomainEntry[]>(
    () =>
      rows
        .map((row, i) => {
          const domain = normalized[i];
          const effective = effectiveWarmupFor(row.id, domain, row.warmup, csvTables);
          const warmup: WarmupFile | undefined = effective
            ? { file: effective.file, rows: row.warmup?.rows ?? null }
            : undefined;
          return { domain, warmup, issue: issues[i] };
        })
        .filter((e) => e.domain.length > 0 && e.issue === null)
        .map(({ domain, warmup }) => ({ domain, warmup })),
    [rows, normalized, issues, csvTables],
  );

  const csvHints = useMemo<(string | null)[]>(
    () =>
      rows.map((row, i) => {
        const domain = normalized[i];
        if (!row.warmup || domain.length === 0) return null;
        const effective = effectiveWarmupFor(row.id, domain, row.warmup, csvTables);
        if (!effective || effective.otherDomains.length === 0) return null;

        const n = effective.otherDomains.length;
        const shown = effective.otherDomains.slice(0, 3).join(", ") + (n > 3 ? "…" : "");

        if (effective.matchedRows === 0) {
          return `Aucune ligne pour ${domain} dans ce CSV — le warm-up ne sera pas utilisé (fichier : ${shown}).`;
        }
        return `${effective.matchedRows} ligne${effective.matchedRows > 1 ? "s" : ""} retenue${effective.matchedRows > 1 ? "s" : ""} pour ce domaine · ${n} autre${n > 1 ? "s" : ""} domaine${n > 1 ? "s" : ""} ignoré${n > 1 ? "s" : ""} dans le fichier (${shown}).`;
      }),
    [rows, normalized, csvTables],
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
    requestAnimationFrame(() => inputRefs.current.get(row.id)?.focus());
  }

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


  async function attachToRow(id: number, file: File) {
    setFileError(null);
    try {
      const warmup = await readWarmupFile(file);
      setRows((current) => current.map((r) => (r.id === id ? { ...r, warmup } : r)));

      try {
        const grouped = groupByDomain(await parseCsvTable(await file.text()));
        setCsvTables((current) => new Map(current).set(id, grouped));
      } catch {
        setCsvTables((current) => {
          if (!current.has(id)) return current;
          const next = new Map(current);
          next.delete(id);
          return next;
        });
      }
    } catch (err) {
      setFileError(err instanceof WarmupError ? err.message : "Fichier illisible.");
    }
  }

  function detachFromRow(id: number) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, warmup: undefined } : r)));
    setCsvTables((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    const input = fileRefs.current.get(id);
    if (input) input.value = "";
  }

  function previewRow(id: number) {
    const row = rows.find((r) => r.id === id);
    if (row?.warmup) setPreviewFile(row.warmup.file);
  }

  function csvFilesFrom(event: React.DragEvent): File[] {
    return [...event.dataTransfer.files];
  }

  function onFormDragEnter(event: React.DragEvent) {
    if (pending || !event.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function onFormDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onFormDrop(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (pending) return;
    if (csvFilesFrom(event).length > 0) {
      setFileError("Déposez le fichier sur le domaine auquel il correspond.");
    }
  }

  function onRowDrop(id: number, event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (pending) return;
    const files = csvFilesFrom(event);
    if (files.length === 0) return;
    void attachToRow(id, files[0]);
    if (files.length > 1) {
      setFileError("Un seul CSV par domaine : seul le premier fichier a été retenu.");
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || entries.length === 0) return;
    onSubmit(entries);
  }

  const attachedCount = rows.filter((r) => r.warmup).length;

  return (
    <form
      onSubmit={submit}
      className={cn("relative w-full", className)}
      noValidate
      onDragEnter={onFormDragEnter}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={onFormDragLeave}
      onDrop={onFormDrop}
    >
      <div
        onDrop={(e) => onRowDrop(rows[0].id, e)}
        className={cn(
          "relative w-full rounded-2xl border bg-bg-elevated/80 p-2 shadow-2xl backdrop-blur transition-colors focus-within:border-accent/60",
          dragging
            ? "border-2 border-dashed border-accent bg-accent/5 focus-within:border-accent"
            : "border-border",
        )}
      >
        <BorderBeam size={120} duration={7} />
        <div className="flex flex-wrap items-center gap-3 px-3">
          <Globe className="size-5 shrink-0 text-text-faint" aria-hidden />
          <div className="relative min-w-[7rem] flex-1 overflow-hidden">
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

          <WarmupSlot
            rowId={rows[0].id}
            warmup={rows[0].warmup}
            disabled={pending}
            registerFileRef={registerFileRef}
            onPick={attachToRow}
            onRemove={() => detachFromRow(rows[0].id)}
            onPreview={() => previewRow(rows[0].id)}
          />

          <button
            type="submit"
            disabled={pending || entries.length === 0}
            aria-label="Analyser"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-3 font-medium text-bg outline-none transition-opacity hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50 sm:px-5"
          >
            <span className="hidden sm:inline">
              {pending
                ? "Analyse…"
                : entries.length > 1
                  ? `Analyser ${entries.length} domaines`
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

      <RowFeedback issue={issues[0]} csvHint={csvHints[0]} className="px-3" />

      {rows.length > 1 && (
        <ul className="mt-3 space-y-2">
          {rows.slice(1).map((row) => {
            const index = rows.findIndex((r) => r.id === row.id);
            return (
              <li key={row.id}>
                <div
                  onDrop={(e) => onRowDrop(row.id, e)}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border bg-bg-elevated/60 px-4 py-1.5 transition-colors focus-within:border-accent/60",
                    dragging
                      ? "border-2 border-dashed border-accent bg-accent/5 focus-within:border-accent"
                      : "border-border",
                  )}
                >
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
                    className="w-full min-w-[7rem] flex-1 bg-transparent py-1.5 font-mono text-sm text-text outline-none placeholder:text-text-faint disabled:opacity-60"
                  />
                  <WarmupSlot
                    rowId={row.id}
                    warmup={row.warmup}
                    disabled={pending}
                    registerFileRef={registerFileRef}
                    onPick={attachToRow}
                    onRemove={() => detachFromRow(row.id)}
                    onPreview={() => previewRow(row.id)}
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
                <RowFeedback issue={issues[index]} csvHint={csvHints[index]} className="px-4" />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            disabled={!canAddRow || pending}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-muted outline-none transition-colors duration-150 hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden />
            Ajouter un domaine
          </button>

          {onBulkImport && (
            <>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept={WARMUP_ACCEPT}
                className="sr-only"
                disabled={pending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setBulkFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-muted outline-none transition-colors duration-150 hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-40"
              >
                <Upload className="size-4" aria-hidden />
                Importer un CSV multi-domaines
              </button>
            </>
          )}
        </div>

        <p className="font-mono text-xs text-text-faint">
          {rows.length} / {MAX_DOMAINS}
          <span className="hidden sm:inline"> · verdict en moins de 15 secondes par domaine</span>
        </p>
      </div>

      <p
        className={cn(
          "mt-2 px-1 text-xs",
          dragging ? "font-medium text-accent" : "text-text-faint",
        )}
      >
        {dragging
          ? "Déposez le CSV sur le domaine auquel il correspond."
          : attachedCount > 0
            ? `${attachedCount} CSV de warm-up joint${attachedCount > 1 ? "s" : ""} · facultatif`
            : "Vous pouvez glisser un CSV de warm-up sur un domaine — facultatif."}
      </p>

      {fileError && !dragging && (
        <p className="mt-2 px-1 text-xs text-avoid" role="alert">
          {fileError}
        </p>
      )}

      {onBulkImport && (
        <CsvBulkImportDialog
          file={bulkFile}
          onOpenChange={(open) => !open && setBulkFile(null)}
          onConfirm={(jobs) => {
            setBulkFile(null);
            onBulkImport(jobs);
          }}
        />
      )}

      <CsvPreviewDialog
        file={previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />
    </form>
  );
}

function WarmupSlot({
  rowId,
  warmup,
  disabled,
  registerFileRef,
  onPick,
  onRemove,
  onPreview,
}: {
  rowId: number;
  warmup?: WarmupFile;
  disabled: boolean;
  registerFileRef: (id: number, el: HTMLInputElement | null) => void;
  onPick: (id: number, file: File) => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const inputId = `warmup-${rowId}`;

  const fileInput = (
    <input
      ref={(el) => registerFileRef(rowId, el)}
      id={inputId}
      type="file"
      accept={WARMUP_ACCEPT}
      className="sr-only"
      disabled={disabled}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onPick(rowId, file);
      }}
    />
  );

  if (!warmup) {
    return (
      <>
        {fileInput}
        <label
          htmlFor={inputId}
          title="Joindre un CSV de warm-up (facultatif)"
          aria-label="Joindre un CSV de warm-up"
          className={cn(
            "shrink-0 cursor-pointer rounded-md p-1.5 text-text-faint outline-none transition-colors duration-150",
            "hover:bg-bg hover:text-text focus-within:ring-[3px] focus-within:ring-accent/30",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <Paperclip className="size-4" aria-hidden />
        </label>
      </>
    );
  }

  return (
    <>
      {fileInput}
      <div className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 py-1 pl-2 pr-1">
        <FileSpreadsheet className="size-3.5 shrink-0 text-accent" aria-hidden />

        <button
          type="button"
          onClick={onPreview}
          className="min-w-0 cursor-pointer text-left outline-none focus-visible:ring-[3px] focus-visible:ring-accent/30"
          title="Aperçu du CSV"
        >
          <span className="block max-w-[9rem] truncate font-mono text-[11px] leading-tight text-text sm:max-w-[13rem]">
            {warmup.file.name}
          </span>
          <span className="block font-mono text-[10px] leading-tight text-text-faint">
            {warmup.rows !== null && `${warmup.rows.toLocaleString("fr-FR")} lignes · `}
            {formatBytes(warmup.file.size)}
          </span>
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Retirer ${warmup.file.name}`}
          className="shrink-0 rounded p-0.5 text-text-faint outline-none transition-colors hover:text-text focus-visible:ring-[3px] focus-visible:ring-accent/30 disabled:opacity-50"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    </>
  );
}

function RowFeedback({
  issue,
  csvHint,
  className,
}: {
  issue: RowIssue;
  csvHint?: string | null;
  className?: string;
}) {
  if (issue) {
    return (
      <p className={cn("mt-1.5 text-xs text-avoid", className)} role="alert">
        {issue === "format"
          ? "Ce nom de domaine n'a pas un format valide — il sera écarté."
          : "Ce domaine est déjà dans la liste : il ne sera analysé qu'une fois."}
      </p>
    );
  }
  if (csvHint) {
    return (
      <p className={cn("mt-1.5 text-xs text-risky", className)}>
        {csvHint}
      </p>
    );
  }
  return null;
}
