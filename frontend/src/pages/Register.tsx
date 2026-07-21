import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthLayout, { AuthDivider } from "@/components/auth/AuthLayout";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength, scorePassword } from "@/components/auth/PasswordStrength";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Errors {
  username?: string;
  entity?: string;
  password?: string;
  confirm?: string;
}

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [entity, setEntity] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    if (username.trim().length < 3)
      errs.username = "Choisissez un nom d'utilisateur d'au moins 3 caractères.";
    if (entity.trim().length === 0) errs.entity = "Veuillez renseigner votre entité.";
    if (password.length < 8)
      errs.password = "Le mot de passe doit contenir au moins 8 caractères.";
    else if (scorePassword(password) < 2)
      errs.password = "Mot de passe trop faible : ajoutez majuscules, chiffres ou symboles.";
    if (confirm !== password)
      errs.confirm = "Les deux mots de passe ne correspondent pas.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPending(true);
    // ponytail: auth simulée, brancher POST /auth/register quand le backend existera
    setTimeout(() => navigate("/app"), 900);
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
        Créer un compte
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Gratuit, jusqu'à 5 domaines par analyse et un verdict en moins de 15 secondes.
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
          <Label htmlFor="entity">Entité</Label>
          <Input
            id="entity"
            type="text"
            placeholder="Votre entité"
            autoComplete="organization"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            aria-invalid={!!errors.entity}
            aria-describedby={errors.entity ? "entity-error" : undefined}
          />
          {errors.entity && (
            <p id="entity-error" className="text-xs text-avoid">
              {errors.entity}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <PasswordInput
            id="password"
            placeholder="8 caractères minimum"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          <PasswordStrength password={password} />
          {errors.password && (
            <p id="password-error" className="text-xs text-avoid">
              {errors.password}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmer le mot de passe</Label>
          <PasswordInput
            id="confirm"
            placeholder="Retapez votre mot de passe"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "confirm-error" : undefined}
          />
          {errors.confirm && (
            <p id="confirm-error" className="text-xs text-avoid">
              {errors.confirm}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" />
              Création du compte…
            </>
          ) : (
            "Créer mon compte"
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-muted">
        Déjà un compte ?{" "}
        <Link to="/login" className="text-accent transition-colors hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}
