import { cn } from "@/lib/utils";

// Robustesse affichée comme un verdict Riskly : mêmes couleurs, badge mono.
const LEVELS = [
  { label: "TROP FAIBLE", bar: "bg-avoid", text: "text-avoid" },
  { label: "FAIBLE", bar: "bg-avoid", text: "text-avoid" },
  { label: "MOYEN", bar: "bg-risky", text: "text-risky" },
  { label: "BON", bar: "bg-good", text: "text-good" },
  { label: "EXCELLENT", bar: "bg-good", text: "text-good" },
] as const;

export function scorePassword(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}

export function PasswordStrength({ password }: { password: string }) {
  if (password.length === 0) return null;

  const score = scorePassword(password);
  const level = LEVELS[score];

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-150",
              i <= score ? level.bar : "bg-border"
            )}
          />
        ))}
      </div>
      <p className={cn("font-mono text-[10px] uppercase tracking-wider", level.text)}>
        {level.label}
      </p>
    </div>
  );
}
