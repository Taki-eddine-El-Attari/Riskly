import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/types/auth";

/**
 * Protège une route : exige une session, et optionnellement un rôle.
 * L'authentification est obligatoire pour toute fonctionnalité d'analyse
 * (PRD §3.2, CA-02).
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin text-text-faint" aria-label="Chargement" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    // `state.from` permet de revenir où l'utilisateur voulait aller.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
