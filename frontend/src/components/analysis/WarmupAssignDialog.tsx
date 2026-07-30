// ◐ Composant en réserve : construit et fonctionnel, monté nulle part.
//
// La saisie fait aujourd'hui de chaque champ de domaine sa propre zone de
// dépôt, ce qui lève l'ambiguïté à la source — cette boîte n'a donc plus lieu
// de s'ouvrir. Elle reste disponible pour un écran où le fichier arrive sans
// cible désignée (import en masse, dépôt depuis l'historique).
//
// Usage : lui passer les fichiers déjà lus et la liste des domaines candidats ;
// elle suggère, l'utilisateur tranche, `onConfirm` rend les couples retenus.

import { useEffect, useState } from "react";
import { Check, FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBytes, matchDomainByFileName } from "@/lib/warmup";
import type { WarmupFile } from "@/lib/warmup";
import { cn } from "@/lib/utils";

/** Un domaine saisi, candidat à recevoir un fichier. */
export interface WarmupTarget {
  rowId: number;
  /** Le domaine saisi, ou une chaîne vide si la ligne est encore vide. */
  domain: string;
  /** Position affichée (1 pour le champ principal). */
  position: number;
  /** La ligne porte déjà un CSV : l'associer le remplacera. */
  hasWarmup: boolean;
}

/** `-1` = ne pas associer ce fichier. */
const IGNORE = -1;

function targetLabel(target: WarmupTarget): string {
  return target.domain || `Domaine ${target.position} (vide)`;
}

/**
 * Choix du domaine auquel rattacher un CSV déposé.
 *
 * Un fichier lâché sur le bloc — et non sur une ligne précise — ne dit pas à
 * quel domaine il appartient. Plutôt que de deviner, on demande. La suggestion
 * de départ reste intelligente (fichier nommé d'après un domaine, sinon
 * première ligne libre), mais elle se corrige en un clic.
 */
export function WarmupAssignDialog({
  files,
  targets,
  onConfirm,
  onCancel,
}: {
  /** Fichiers déposés, déjà lus et validés. Vide = boîte fermée. */
  files: WarmupFile[];
  targets: WarmupTarget[];
  onConfirm: (assignment: { file: WarmupFile; rowId: number }[]) => void;
  onCancel: () => void;
}) {
  const [choices, setChoices] = useState<number[]>([]);

  // Suggestions recalculées à chaque nouveau dépôt : le fichier nommé d'après
  // un domaine y va, les autres comblent les emplacements encore libres.
  useEffect(() => {
    const domains = targets.map((t) => t.domain);
    const taken: number[] = [];

    setChoices(
      files.map((file) => {
        const byName = matchDomainByFileName(file.file.name, domains);
        const suggested =
          byName >= 0 && !taken.includes(targets[byName].rowId)
            ? targets[byName].rowId
            : (targets.find((t) => !t.hasWarmup && !taken.includes(t.rowId))?.rowId ?? IGNORE);

        if (suggested !== IGNORE) taken.push(suggested);
        return suggested;
      }),
    );
  }, [files, targets]);

  const open = files.length > 0;
  const many = files.length > 1;

  function choose(fileIndex: number, rowId: number) {
    setChoices((current) =>
      current.map((choice, i) => {
        if (i === fileIndex) return choice === rowId ? IGNORE : rowId;
        // Un domaine ne reçoit qu'un fichier : l'autre sélection se libère.
        return choice === rowId && rowId !== IGNORE ? IGNORE : choice;
      }),
    );
  }

  function confirm() {
    onConfirm(
      files
        .map((file, i) => ({ file, rowId: choices[i] ?? IGNORE }))
        .filter((entry) => entry.rowId !== IGNORE),
    );
  }

  const assignedCount = choices.filter((c) => c !== IGNORE).length;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {many ? "À quels domaines associer ces fichiers ?" : "À quel domaine associer ce fichier ?"}
          </DialogTitle>
          <DialogDescription>
            {many
              ? "Un fichier par domaine. Laissez un fichier sans domaine pour ne pas l'utiliser."
              : "Choisissez le domaine dont ce CSV décrit le warm-up."}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-4">
          {files.map((file, fileIndex) => (
            <li key={`${file.file.name}-${fileIndex}`}>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="truncate font-mono text-sm text-text">{file.file.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-text-faint">
                  {file.rows !== null && `${file.rows.toLocaleString("fr-FR")} lignes · `}
                  {formatBytes(file.file.size)}
                </span>
              </div>

              <div
                className="mt-2 grid gap-2"
                role="radiogroup"
                aria-label={`Domaine pour ${file.file.name}`}
              >
                {targets.map((target) => {
                  const selected = choices[fileIndex] === target.rowId;
                  const takenByOther = choices.some(
                    (choice, i) => i !== fileIndex && choice === target.rowId,
                  );

                  return (
                    <button
                      key={target.rowId}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={takenByOther}
                      onClick={() => choose(fileIndex, target.rowId)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors duration-150",
                        "focus-visible:ring-[3px] focus-visible:ring-accent/30",
                        selected
                          ? "border-accent bg-accent/10"
                          : "border-border bg-bg hover:border-border-hover",
                        takenByOther && "pointer-events-none opacity-40",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border",
                          selected ? "border-accent bg-accent text-bg" : "border-border-hover",
                        )}
                        aria-hidden
                      >
                        {selected && <Check className="size-3" strokeWidth={3} />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate font-mono text-sm",
                            target.domain ? "text-text" : "text-text-faint",
                          )}
                        >
                          {targetLabel(target)}
                        </span>
                        {target.hasWarmup && (
                          <span className="block font-mono text-[10px] text-risky">
                            remplacera le CSV déjà joint
                          </span>
                        )}
                      </span>

                      {takenByOther && (
                        <span className="shrink-0 font-mono text-[10px] text-text-faint">
                          pris
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="button" onClick={confirm} disabled={assignedCount === 0}>
            {assignedCount > 1 ? `Associer ${assignedCount} fichiers` : "Associer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
