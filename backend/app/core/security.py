import hashlib
import hmac
import time
import uuid

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User


# --- Mots de passe (auth locale) ---------------------------------------------
def hash_password(mot_de_passe: str) -> str:
    hashed = bcrypt.hashpw(mot_de_passe.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(mot_de_passe: str, mot_de_passe_hash: str) -> bool:
    if not mot_de_passe_hash:  # compte Telegram : pas de mot de passe
        return False
    return bcrypt.checkpw(
        mot_de_passe.encode("utf-8"), mot_de_passe_hash.encode("utf-8")
    )


# --- Vérification du Login Widget Telegram -----------------------------------
def verify_telegram_auth(fields: dict, bot_token: str, max_age: int) -> bool:
    """Valide la signature Telegram (algorithme officiel) + la fraîcheur.

    `fields` = données envoyées par Telegram (hash inclus, None exclus).
      1. data_check_string = "clé=valeur" triées, jointes par "\\n" (sans hash)
      2. clé secrète = SHA256(bot_token)
      3. hash attendu = HMAC-SHA256(data_check_string, clé secrète)
    """
    received_hash = str(fields.get("hash", ""))
    check = {k: v for k, v in fields.items() if k != "hash"}
    check_string = "\n".join(f"{k}={check[k]}" for k in sorted(check))

    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed_hash = hmac.new(
        secret_key, check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return False
    return (time.time() - int(fields.get("auth_date", 0))) < max_age


# --- Session (cookie signé via SessionMiddleware) ----------------------------
def set_auth_cookie(request: Request, user_id: str) -> None:
    request.session["user_id"] = str(user_id)


def clear_auth_cookie(request: Request) -> None:
    request.session.pop("user_id", None)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Non authentifié",
        )
    user = db.query(User).filter(User.id == uuid.UUID(str(user_id))).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur non trouvé",
        )
    return user


# --- Gardes de rôle ----------------------------------------------------------
def require_role(*allowed_roles: str):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role requis : {','.join(allowed_roles)}",
            )
        return current_user

    return role_checker


require_admin = require_role("admin", "superadmin")
require_superadmin = require_role("superadmin")
require_authenticated = require_role("user", "admin", "superadmin")
# Alias rétro-compatible (ancienne orthographe utilisée ailleurs).
require_autheticated = require_authenticated
