import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthLayout, { AuthDivider } from "@/components/auth/AuthLayout";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!EMAIL_RE.test(email)) errs.email = "Adresse email invalide.";
    if (password.length === 0) errs.password = "Veuillez saisir votre mot de passe.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPending(true);
    // ponytail: auth simulée — brancher POST /api/auth/login quand le backend existera
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

      <AuthDivider label="ou par email" />

      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="vous@exemple.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-avoid">
              {errors.email}
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

        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
          />
          <Label htmlFor="remember" className="font-normal text-text-muted">
            Se souvenir de moi
          </Label>
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
