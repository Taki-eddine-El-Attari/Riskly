import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthLayout, { AuthDivider } from "@/components/auth/AuthLayout";
import { TelegramLogin } from "@/components/auth/TelegramLogin";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength, scorePassword } from "@/components/auth/PasswordStrength";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as authApi from "@/api/auth.api";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api-client";

// Ensemble fermé des entités disponibles (CMH1 à CMH16).
const ENTITIES = Array.from({ length: 16 }, (_, i) => `CMH${i + 1}`);

interface Errors {
  username?: string;
  entity?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

// Source unique de vérité pour chaque règle de validation : utilisées à la
// fois par les onChange (validation en direct) et par submit(), pour éviter
// que les deux se désynchronisent (c'était la cause des bugs précédents).
function validateUsername(value: string): string | undefined {
  return value.trim().length < 3
    ? "Choisissez un nom d'utilisateur d'au moins 3 caractères."
    : undefined;
}

function validateEntity(value: string): string | undefined {
  return value.trim().length === 0 ? "Veuillez renseigner votre entité." : undefined;
}

// Miroir des règles de app/schemas/user.py::UserRegister.password_complexity
// (au moins un chiffre + une majuscule), en plus du seuil de longueur et de
// la force générale — sans ça, un mot de passe jugé "BON" côté frontend peut
// quand même être rejeté par le backend avec un 422.
function validatePassword(value: string): string | undefined {
  if (value.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/\d/.test(value)) return "Le mot de passe doit contenir au moins un chiffre.";
  if (!/[A-Z]/.test(value)) return "Le mot de passe doit contenir au moins une majuscule.";
  if (scorePassword(value) < 2)
    return "Mot de passe trop faible : ajoutez majuscules, chiffres ou symboles.";
  return undefined;
}

function validateConfirm(confirmValue: string, passwordValue: string): string | undefined {
  return confirmValue !== passwordValue ? "Les deux mots de passe ne correspondent pas." : undefined;
}

export default function Register() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [username, setUsername] = useState("");
  const [entity, setEntity] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errors = {
      username: validateUsername(username),
      entity: validateEntity(entity),
      password: validatePassword(password),
      confirm: validateConfirm(confirm, password),
    };
    setErrors(errs);
    if (Object.values(errs).some((msg) => msg !== undefined)) return;

    setPending(true);
    try {
      await authApi.register(username.trim(), password, entity.trim());
      await refreshUser();
      navigate("/app", { replace: true });
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ username: "Ce nom d'utilisateur est déjà utilisé." });
      } else if (err instanceof ApiError && err.status === 422) {
        setErrors({ form: err.message });
      } else {
        setErrors({ form: "Une erreur est survenue. Veuillez réessayer." });
      }
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
        Créer un compte
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Gratuit, jusqu'à 5 domaines par analyse et un verdict en moins de 15 secondes.
      </p>

      <TelegramLogin className="mt-8" />

      <AuthDivider label="ou" />

      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="username">Nom d'utilisateur</Label>
          <Input
            id="username"
            type="text"
            placeholder="John"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              const value = e.target.value;
              setUsername(value);
              setErrors((prev) => ({ ...prev, username: validateUsername(value) }));
            }}
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
          <Select
            value={entity}
            onValueChange={(value) => {
              setEntity(value);
              setErrors((prev) => ({ ...prev, entity: validateEntity(value) }));
            }}
          >
            <SelectTrigger
              id="entity"
              aria-invalid={!!errors.entity}
              aria-describedby={errors.entity ? "entity-error" : undefined}
            >
              <SelectValue placeholder="Sélectionnez votre entité" />
            </SelectTrigger>
            <SelectContent>
              {ENTITIES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            onChange={(e) => {
              const value = e.target.value;
              setPassword(value);
              setErrors((prev) => ({
                ...prev,
                password: validatePassword(value),
                // Si "Confirmer" a déjà une valeur, la comparaison doit suivre
                // les modifications du mot de passe, pas seulement celles de "Confirmer".
                confirm: confirm.length > 0 ? validateConfirm(confirm, value) : prev.confirm,
              }));
            }}
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
            onChange={(e) => {
              const value = e.target.value;
              setConfirm(value);
              setErrors((prev) => ({ ...prev, confirm: validateConfirm(value, password) }));
            }}
            aria-invalid={!!errors.confirm}
            aria-describedby={errors.confirm ? "confirm-error" : undefined}
          />
          {errors.confirm && (
            <p id="confirm-error" className="text-xs text-avoid">
              {errors.confirm}
            </p>
          )}
        </div>

        {errors.form && (
          <p role="alert" className="text-sm text-avoid">
            {errors.form}
          </p>
        )}

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
