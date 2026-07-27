import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import type { AuthContextValue } from "@/context/AuthContext";

/** Accès au contexte d'authentification. Doit être appelé sous <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un <AuthProvider>.");
  }
  return ctx;
}
