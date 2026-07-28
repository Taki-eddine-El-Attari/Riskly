from fastapi import Request
from fastapi.responses import JSONResponse


class RisklyException(Exception):
    status_code: int = 500
    def __init__(self, message: str):
        self.message = message
        super().__init__(self.message)


async def riskly_exception_handler(request: Request, exc: RisklyException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "message": exc.message},
    )

class UserAlreadyExistsError(RisklyException):
    status_code = 409

    def __init__(self, identifier: str):
        self.identifier = identifier
        super().__init__(f"L'utilisateur ou l'email '{identifier}' existe déjà.")

class HTTP_401_UNAUTHORIZED(RisklyException):
    status_code = 401
    def __init__(self):
        super().__init__("Identifiants de connexion invalides.")


class HTTP_403_FORBIDEN(RisklyException):
    status_code = 403
    def __init__(self, action: str = "cette action"):
        self.action = action
        super().__init__(f"Permissions insuffisantes pour effectuer : {action}.")


class InvalidDomainFormatError(RisklyException):
    status_code = 422

    def __init__(self, domain: str):
        self.domain = domain
        super().__init__(f"Le format du domaine '{domain}' est invalide.")


class DomainLimitExceededError(RisklyException):
    status_code = 422

    def __init__(self, count: int, limit: int = 5):
        self.count = count
        self.limit = limit
        super().__init__(
            f"Limite dépassée : {limit} domaines maximum par analyse (reçu {count})."
        )


class AnalysisNotFoundError(RisklyException):
    status_code = 404
    def __init__(self, analysis_id: str):
        self.analysis_id = analysis_id
        super().__init__(f"L'analyse '{analysis_id}' est introuvable.")


class AnalysisAlreadyInProgressError(RisklyException):
    status_code = 409
    def __init__(self, domain: str):
        self.domain = domain
        super().__init__(
            f"Une analyse pour le domaine '{domain}' est déjà en cours."
        )


class UnregisteredDomainError(RisklyException):
    status_code = 404
    def __init__(self, domain: str):
        self.domain = domain
        super().__init__(f"Le domaine '{domain}' n'est pas enregistré.")


class NoActiveModelError(RisklyException):
    status_code = 503
    def __init__(self):
        super().__init__(
            "Aucun modèle ML actif n'est disponible pour l'inférence."
        )


class PredictionError(RisklyException):
    status_code = 500
    def __init__(self, message: str = "Échec du calcul de la prédiction."):
        super().__init__(message)


class ExternalAPIError(RisklyException):
    status_code = 502
    def __init__(self, source_name: str, message: str):
        self.source_name = source_name
        super().__init__(f"Erreur avec la source '{source_name}': {message}")


class ExternalAPITimeoutError(ExternalAPIError):
    status_code = 504
    def __init__(self, source_name: str):
        super().__init__(source_name, "La requête a expiré (Timeout).")


class ExternalAPIRateLimitError(ExternalAPIError):
    status_code = 429
    def __init__(self, source_name: str):
        super().__init__(
            source_name, "Limite de requêtes dépassée (Rate Limit 429)."
        )


class ExternalServiceUnavailableError(ExternalAPIError):
    status_code = 503
    def __init__(self, source_name: str):
        super().__init__(source_name, "Service temporairement indisponible.")

class AuthenticationError(RisklyException):
    status_code = 401
    def __init__(self, message: str = "Non authentifié."):
        super().__init__(message)


class UsernameDejaUtiliseError(RisklyException):
    status_code = 409
    def __init__(self, username: str):
        self.username = username
        super().__init__(f"Le nom d'utilisateur '{username}' est déjà utilisé.")


class IdentifiantsInvalidesError(RisklyException):
    status_code = 401
    def __init__(self, message: str = "Identifiants invalides."):
        super().__init__(message)


class MotDePasseFaibleError(RisklyException):
    status_code = 422
    def __init__(self, min_length: int = 8):
        self.min_length = min_length
        super().__init__(
            f"Mot de passe trop faible : {min_length} caractères minimum."
        )


class PermissionInsuffisanteError(RisklyException):
    status_code = 403
    def __init__(self, message: str = "Permissions insuffisantes."):
        super().__init__(message)


class UtilisateurNonTrouveError(RisklyException):
    status_code = 404
    def __init__(self, message: str = "Utilisateur introuvable."):
        super().__init__(message)


class ProtectionSuperadminError(RisklyException):
    status_code = 403
    def __init__(self, message: str = "Action interdite sur le superadmin."):
        super().__init__(message)


class AutoSuppressionError(RisklyException):
    status_code = 400
    def __init__(self, message: str = "Vous ne pouvez pas supprimer votre propre compte."):
        super().__init__(message)


class TelegramAuthError(RisklyException):
    status_code = 401
    def __init__(self, message: str = "Vérification Telegram échouée (signature invalide ou expirée)."):
        super().__init__(message)

class LimiteConcurrenceAtteinte(Exception):
    def __init__(self, max_concurrent : int):
        self.max_concurrent = max_concurrent
        super().__init__(
            f"Limite de {max_concurrent} analyses simultanées atteinte. "
            "Attendez qu'une analyse se termine avant d'en lancer une nouvelle."
        )
                