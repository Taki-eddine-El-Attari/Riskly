import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthLayout, { AuthDivider } from "@/components/auth/AuthLayout";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength, scorePassword } from "@/components/auth/PasswordStrength";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Errors {
  name?: string;
  email?: string;
  password?: string;
  terms?: string;
}

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    if (name.trim().length < 2) errs.name = "Veuillez renseigner votre nom.";
    if (!EMAIL_RE.test(email)) errs.email = "Adresse email invalide.";
    if (password.length < 8)
      errs.password = "Le mot de passe doit contenir au moins 8 caractères.";
    else if (scorePassword(password) < 2)
      errs.password = "Mot de passe trop faible — ajoutez majuscules, chiffres ou symboles.";
    if (!terms) errs.terms = "Vous devez accepter les conditions d'utilisation.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setPending(true);
    // ponytail: auth simulée — brancher POST /api/auth/register quand le backend existera
    setTimeout(() => navigate("/app"), 900);
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
        Créer un compte
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Gratuit — jusqu'à 5 domaines par analyse, verdict en quelques secondes.
      </p>

      <OAuthButtons className="mt-8" />

      <AuthDivider label="ou par email" />

      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Nom complet</Label>
          <Input
            id="name"
            type="text"
            placeholder="Jimmy Dolio"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-xs text-avoid">
              {errors.name}
            </p>
          )}
        </div>

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
          <div className="flex items-start gap-2">
            <Checkbox
              id="terms"
              checked={terms}
              onCheckedChange={(v) => setTerms(v === true)}
              aria-invalid={!!errors.terms}
              aria-describedby={errors.terms ? "terms-error" : undefined}
              className="mt-0.5"
            />
            <Label
              htmlFor="terms"
              className="inline-block font-normal leading-snug text-text-muted"
            >
              <span>
                J'accepte les{" "}
                <a href="#" className="text-text underline underline-offset-2 hover:text-accent">
                  conditions d'utilisation
                </a>{" "}
                et la{" "}
                <a href="#" className="text-text underline underline-offset-2 hover:text-accent">
                  politique de confidentialité
                </a>
                .
              </span>
            </Label>
          </div>
          {errors.terms && (
            <p id="terms-error" className="text-xs text-avoid">
              {errors.terms}
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
