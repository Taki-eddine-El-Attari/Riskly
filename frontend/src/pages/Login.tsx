import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthLayout, { AuthDivider } from "@/components/auth/AuthLayout";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [pending, setPending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (username.trim().length === 0)
      errs.username = "Veuillez saisir votre nom d'utilisateur.";
    if (password.length === 0) errs.password = "Veuillez saisir votre mot de passe.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPending(true);
    // ponytail: auth simulée, brancher POST /auth/login quand le backend existera
    setTimeout(() => navigate("/app"), 900);
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
        Bon retour
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Connectez-vous pour retrouver vos analyses et votre historique.
      </p>

      <OAuthButtons className="mt-8" />

      <AuthDivider label="ou" />

      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="username">Nom d'utilisateur</Label>
          <Input
            id="username"
            type="text"
            placeholder="jimmy"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? "username-error" : undefined}
          />
          {errors.username && (
            <p id="username-error" className="text-xs text-avoid">
              {errors.username}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-accent transition-colors hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password && (
            <p id="password-error" className="text-xs text-avoid">
              {errors.password}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Connexion…
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
        Pas encore de compte ?{" "}
        <Link to="/register" className="text-accent transition-colors hover:underline">
          Créer un compte
        </Link>
      </p>
    </AuthLayout>
  );
}
