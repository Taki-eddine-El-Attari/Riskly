import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, FileSpreadsheet, Globe, Loader2, Paperclip, Plus, Upload, X } from "lucide-react";
import { BorderBeam } from "@/components/landing/effects/BorderBeam";
import { useTypingPlaceholder } from "@/hooks/useTypingPlaceholder";
import { MAX_DOMAINS } from "@/lib/constants";
import { isValidDomain, normalizeDomain, splitDomains } from "@/lib/domains";
import {
  formatBytes,
  matchDomainByFileName,
  readWarmupFile,
  WARMUP_ACCEPT,
  WarmupError,
} from "@/lib/warmup";
import type { WarmupFile } from "@/lib/warmup";
import { WarmupAssignDialog } from "./WarmupAssignDialog";
import type { WarmupTarget } from "./WarmupAssignDialog";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "exemple-domaine.com",
  "boutique-mode.fr",
  "crypto-invest.io",
  "agence-web.ma",
];

/** Un domaine soumis, avec son CSV de warm-up optionnel. */
export interface DomainEntry {
  domain: string;
  warmup?: File;
}

interface Row {
  id: number;
  value: string;
  warmup?: WarmupFile;
}

type RowIssue = "format" | "duplicate" | null;

let nextId = 1;
const newRow = (value = ""): Row => ({ id: nextId++, value });

/**
 * Saisie de 1 à 5 domaines, chacun avec un CSV de warm-up optionnel.
 *
 * Le premier champ reprend exactement le champ du hero de la landing (coque
 * arrondie, lueur de bordure, placeholder qui se tape) : l'utilisateur qui
 * arrive de la vitrine retrouve le même geste après connexion. Les domaines
 * suivants s'ajoutent en lignes compactes en dessous.
 *
 * Le format est validé au fil de l'eau et les doublons sont signalés — un
 * domaine invalide est écarté sans bloquer les autres (PRD, UC-03 A2/A3).
 *
 * Warm-up : un CSV se dépose sur la ligne d'un domaine, ou n'importe où sur le
 * bloc — dans ce cas les fichiers sont répartis, en priorité vers le domaine
 * dont ils portent le nom. Le trombone ouvre le sélecteur pour ceux qui
 * préfèrent cliquer.
 */
export function DomainInput({
  onSubmit,
  pending = false,
  className,
}: {
  onSubmit: (entries: DomainEntry[]) => void;
  pending?: boolean;
  className?: string;
}) {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  /** Fichiers déposés sur le bloc, en attente d'un domaine. */
  const [pendingFiles, setPendingFiles] = useState<WarmupFile[]>([]);
  const inputRefs = useRef(new Map<number, HTMLInputElement>());
  const fileRefs = useRef(new Map<number, HTMLInputElement>());
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

  const entries = useMemo<DomainEntry[]>(
    () =>
      rows
        .map((row, i) => ({ domain: normalized[i], warmup: row.warmup?.file, issue: issues[i] }))
        .filter((e) => e.domain.length > 0 && e.issue === null)
        .map(({ domain, warmup }) => ({ domain, warmup })),
    [rows, normalized, issues],
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

  // ── Warm-up : rattachement des fichiers ──────────────────────────────────

  async function attachToRow(id: number, file: File) {
    setFileError(null);
    try {
      const warmup = await readWarmupFile(file);
      setRows((current) => current.map((r) => (r.id === id ? { ...r, warmup } : r)));
    } catch (err) {
      setFileError(err instanceof WarmupError ? err.message : "Fichier illisible.");
    }
  }

  function detachFromRow(id: number) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, warmup: undefined } : r)));
    const input = fileRefs.current.get(id);
    if (input) input.value = ""; // permet de re-choisir le même fichier
  }

  /**
   * Dépôt hors d'une ligne précise : rien n'indique à quel domaine le fichier
   * appartient. On lit et valide, puis on ouvre la boîte de choix — sauf s'il
   * n'y a qu'une seule ligne, auquel cas il n'y a rien à choisir.
   */
  async function spreadFiles(files: File[]) {
    setFileError(null);

    const read = await Promise.all(
      files.map(async (file) => {
        try {
          return { warmup: await readWarmupFile(file), error: null as string | null };
        } catch (err) {
          return {
            warmup: null,
            error: err instanceof WarmupError ? err.message : "Fichier illisible.",
          };
        }
      }),
    );

    const firstError = read.find((r) => r.error)?.error ?? null;
    if (firstError) setFileError(firstError);

    const valid = read.map((r) => r.warmup).filter((w): w is WarmupFile => w !== null);
    if (valid.length === 0) return;

    if (rows.length === 1) {
      const [first] = valid;
      setRows((current) => current.map((row, i) => (i === 0 ? { ...row, warmup: first } : row)));
      if (valid.length > 1) {
        setFileError("Un seul CSV par domaine : les fichiers en trop ont été ignorés.");
      }
      return;
    }

    setPendingFiles(valid.slice(0, rows.length));
    if (valid.length > rows.length) {
      setFileError(
        `${valid.length - rows.length} fichier(s) en trop : il n'y a que ${rows.length} domaines.`,
      );
    }
  }

  /** Suggestion de départ dans la boîte de choix, jamais imposée. */
  const suggestTarget = useCallback(
    (file: WarmupFile, taken: number[]) => {
      const byName = matchDomainByFileName(file.file.name, normalized);
      if (byName >= 0 && !taken.includes(rows[byName].id)) return rows[byName].id;

      const free = rows.find((row) => !row.warmup && !taken.includes(row.id));
      return free ? free.id : -1;
    },
    [rows, normalized],
  );

  function applyAssignment(entries: { file: WarmupFile; rowId: number }[]) {
    setRows((current) =>
      current.map((row) => {
        const match = entries.find((e) => e.rowId === row.id);
        return match ? { ...row, warmup: match.file } : row;
      }),
    );
    setPendingFiles([]);
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
    const files = csvFilesFrom(event);
    if (files.length > 0) void spreadFiles(files);
  }

  function onRowDrop(id: number, event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (pending) return;
    const [file] = csvFilesFrom(event);
    if (file) void attachToRow(id, file);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || entries.length === 0) return;
    onSubmit(entries);
  }

  const attachedCount = rows.filter((r) => r.warmup).length;

  const targets = useMemo<WarmupTarget[]>(
    () =>
      rows.map((row, i) => ({
        rowId: row.id,
        domain: normalized[i],
        position: i + 1,
        hasWarmup: row.warmup !== undefined,
      })),
    [rows, normalized],
  );

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
      {/* Champ principal — identique au hero de la landing. */}
      <div
        onDrop={(e) => onRowDrop(rows[0].id, e)}
        className="relative w-full rounded-2xl border border-border bg-bg-elevated/80 p-2 shadow-2xl backdrop-blur transition-colors focus-within:border-accent/60"
      >
        <BorderBeam size={120} duration={7} />
        {/* `flex-wrap` : à l'étroit (mobile), la pastille du CSV passe à la
            ligne au lieu d'écraser le champ. */}
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

      <RowFeedback issue={issues[0]} className="px-3" />

      {/* Domaines 2 à 5. */}
      {rows.length > 1 && (
        <ul className="mt-3 space-y-2">
          {rows.slice(1).map((row) => {
            const index = rows.findIndex((r) => r.id === row.id);
            return (
              <li key={row.id}>
                <div
                  onDrop={(e) => onRowDrop(row.id, e)}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg-elevated/60 px-4 py-1.5 transition-colors focus-within:border-accent/60"
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

      <p className="mt-2 px-1 text-xs text-text-faint">
        {attachedCount > 0
          ? `${attachedCount} CSV de warm-up joint${attachedCount > 1 ? "s" : ""} · facultatif`
          : "Vous pouvez glisser un CSV de warm-up par domaine — facultatif."}
      </p>

      {fileError && (
        <p className="mt-2 px-1 text-xs text-avoid" role="alert">
          {fileError}
        </p>
      )}

      {/* Voile de dépôt : n'apparaît que pendant un glisser de fichiers. */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-bg/90 backdrop-blur-sm">
          <div className="text-center">
            <Upload className="mx-auto size-6 text-accent" aria-hidden />
            <p className="mt-2 text-sm font-medium text-text">Déposez vos CSV de warm-up</p>
            <p className="mt-1 font-mono text-xs text-text-faint">
              {rows.length > 1
                ? "sur une ligne pour l'associer à ce domaine, ou ici pour choisir"
                : "pour l'associer à ce domaine"}
            </p>
          </div>
        </div>
      )}

      <WarmupAssignDialog
        files={pendingFiles}
        targets={targets}
        suggestFor={suggestTarget}
        onConfirm={applyAssignment}
        onCancel={() => setPendingFiles([])}
      />
    </form>
  );
}

/**
 * L'emplacement du CSV, à droite du nom de domaine, dans le champ lui-même.
 *
 * Vide, c'est un trombone discret. Rempli, il devient une pastille sur deux
 * lignes — le nom du fichier, puis ce qu'il contient — de sorte que le fichier
 * reste visuellement rattaché à SON domaine plutôt que posé sous le champ.
 */
function WarmupSlot({
  rowId,
  warmup,
  disabled,
  registerFileRef,
  onPick,
  onRemove,
}: {
  rowId: number;
  warmup?: WarmupFile;
  disabled: boolean;
  registerFileRef: (id: number, el: HTMLInputElement | null) => void;
  onPick: (id: number, file: File) => void;
  onRemove: () => void;
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

        {/* Cliquer la pastille remplace le fichier ; la croix le retire. */}
        <label htmlFor={inputId} className="min-w-0 cursor-pointer" title="Remplacer le fichier">
          <span className="block max-w-[9rem] truncate font-mono text-[11px] leading-tight text-text sm:max-w-[13rem]">
            {warmup.file.name}
          </span>
          <span className="block font-mono text-[10px] leading-tight text-text-faint">
            {warmup.rows !== null && `${warmup.rows.toLocaleString("fr-FR")} lignes · `}
            {formatBytes(warmup.file.size)}
          </span>
        </label>

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
