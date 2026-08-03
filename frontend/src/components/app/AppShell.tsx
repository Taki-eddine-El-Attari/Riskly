import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { LogOut, User as UserIcon } from "lucide-react";
import { RisklyLogo } from "@/components/landing/RisklyLogo";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", label: "Analyser" },
  { to: "/history", label: "Historique" },
];

const ROLE_LABELS: Record<string, string> = {
  user: "Utilisateur",
  admin: "Administrateur",
  superadmin: "Super-administrateur",
};

function UserMenu() {
  const { user, logout } = useAuth();
  const [imgError, setImgError] = useState(false);
  const initial = user?.username?.charAt(0).toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm outline-none transition-colors duration-150 hover:bg-bg-elevated focus-visible:ring-[3px] focus-visible:ring-accent/30"
        aria-label="Menu utilisateur"
      >
        {user?.photo_url && !imgError ? (
          <img
            src={user.photo_url}
            alt={user.username}
            onError={() => setImgError(true)}
            className="size-7 rounded-md border border-border object-cover"
          />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-md border border-border bg-bg-elevated font-mono text-xs text-text-muted">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate font-mono text-xs text-text-muted sm:block">
          {user?.username ?? "…"}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-mono text-sm text-text">
            {user?.username ?? "—"}
          </span>
          <span className="mt-0.5 block font-mono text-[11px] text-text-faint">
            {[user?.entite, user?.role ? ROLE_LABELS[user.role] ?? user.role : null]
              .filter(Boolean)
              .join(" · ") || "Compte Riskly"}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/history">
            <UserIcon aria-hidden />
            Mes analyses
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => void logout()}
          className="text-avoid data-[highlighted]:bg-avoid/10 data-[highlighted]:text-avoid"
        >
          <LogOut aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
          <Link to="/app" className="flex shrink-0 items-center gap-2">
            <RisklyLogo className="h-5 w-auto" />
            <span className="font-display text-base font-bold">Riskly</span>
          </Link>

          <div className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-1.5 text-sm outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-accent/30",
                    isActive
                      ? "bg-bg-elevated text-text"
                      : "text-text-muted hover:text-text",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <p className="mx-auto max-w-6xl px-6 py-5 text-center font-mono text-xs text-text-faint">
          © 2026 Riskly · Domain Risk Analyzer
        </p>
      </footer>
    </div>
  );
}
