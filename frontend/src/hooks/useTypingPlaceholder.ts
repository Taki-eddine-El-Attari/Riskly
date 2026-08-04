import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

export function useTypingPlaceholder(examples: string[], paused: boolean): string {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState({ i: 0, len: 0, deleting: false });
  const word = examples[phase.i] ?? "";

  useEffect(() => {
    if (reduced || paused) return;
    const done = !phase.deleting && phase.len === word.length;
    const delay = phase.deleting ? 35 : done ? 1800 : 70;
    const t = setTimeout(() => {
      setPhase((p) => {
        const w = examples[p.i] ?? "";
        if (!p.deleting) {
          if (p.len === w.length) return { ...p, deleting: true };
          return { ...p, len: p.len + 1 };
        }
        if (p.len === 0) {
          return { i: (p.i + 1) % examples.length, len: 0, deleting: false };
        }
        return { ...p, len: p.len - 1 };
      });
    }, delay);
    return () => clearTimeout(t);
  }, [phase, paused, reduced, word.length, examples]);

  return reduced ? (examples[0] ?? "") : word.slice(0, phase.len);
}
