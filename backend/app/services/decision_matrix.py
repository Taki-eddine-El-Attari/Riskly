from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional

import numpy as np

class Verdict(Enum):
    DANGEROUS = "dangerous"
    NOT_WORTH_IT = "not_worth_it"
    RISKY = "risky"
    WORTH_BUYING = "worth_buying"
    # Aucun signal externe exploitable : le modele de risque extrapolerait
    # hors de sa zone d'entrainement (il n'a vu que des domaines actifs).
    # Mieux vaut dire "je ne sais pas" qu'affirmer un verdict infonde.
    INSUFFICIENT_DATA = "insufficient_data"


@dataclass
class DecisionResult:
    verdict: Verdict
    verdict_label: str
    verdict_color: str
    hard_veto: bool
    confidence: float

    malicious_prob: float
    authority_score: float
    email_health_score: float
    email_was_missing: bool
    base_value_score: float
    security_factor: float
    final_score: float

    reason: str
    recommendation: str
    breakdown: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "verdict": self.verdict.value,
            "verdict_label": self.verdict_label,
            "verdict_color": self.verdict_color,
            "hard_veto": self.hard_veto,
            "confidence": round(self.confidence, 4),
            "scores": {
                "malicious_prob": self.malicious_prob,
                "authority": self.authority_score,
                "email_health": self.email_health_score,
                "email_missing": self.email_was_missing,
                "base_value": self.base_value_score,
                "security_factor": self.security_factor,
                "final": self.final_score,
            },
            "reason": self.reason,
            "recommendation": self.recommendation,
            "breakdown": self.breakdown,
        } 

@dataclass
class DecisionMatrixInput:
    malicious_prob: float
    email_health_prob: Optional[float]
    rank: Optional[float]
    backlinks_total: Optional[int]
    domain_age_days: int
    # Nombre de serveurs de noms. `None` = le DNS n'a pas repondu du tout
    # (domaine inactif / expire), a distinguer d'un domaine actif mesure.
    ns_server_count: Optional[int] = None

def _normalize_rank(rank: Optional[float]) -> float:
    # `rank` est le score OpenPageRank (echelle 0-10, PLUS HAUT = meilleur —
    # cf. collectors/rank.py, feature_builder.py, collect_fe_4.py). Ce n'est
    # PAS un rang positionnel type Alexa (1 = meilleur, 1e9 = pire) : une
    # normalisation logarithmique pensee pour ce dernier cas inverserait le
    # signal sur l'echelle 0-10 reellement utilisee ici.
    if rank is None or rank <= 0:
        return 0.0
    return float(np.clip(rank / 10.0, 0.0, 1.0))


def _normalize_backlinks(count: Optional[int]) -> float:
    if count is None or count <= 0:
        return 0.0
    # Distribution en loi de puissance (quelques dizaines pour un petit site,
    # plusieurs millions pour les plus gros) : une normalisation lineaire sature
    # instantanement (ex. 10 000 domaines referents) et ne discrimine plus rien
    # au-dela. Echelle logarithmique, plafonnee a 1M domaines referents (profil
    # quasi maximal, ex. wikipedia/google).
    return float(np.clip(np.log10(count + 1) / np.log10(1_000_000), 0.0, 1.0))


def _normalize_age(days: int) -> float:
    if days <= 0:
        return 0.0
    return float(np.clip(days / 3650, 0.0, 1.0))

class DecisionMatrix:
    def __init__(
        self,
        malicious_threshold: float = 0.50,
        worth_buying_threshold: float = 0.60,
        risky_threshold: float = 0.30,
        authority_weight: float = 0.5,
        email_weight: float = 0.5,
    ):
        self.malicious_threshold = malicious_threshold
        self.worth_buying_threshold = worth_buying_threshold
        self.risky_threshold = risky_threshold
        self.authority_weight = authority_weight
        self.email_weight = email_weight

        self.w_rank = 0.5
        self.w_backlinks = 0.3
        self.w_age = 0.2

    @staticmethod
    def _signals_are_insufficient(data: DecisionMatrixInput) -> bool:
        """Vrai quand AUCUN signal externe n'a pu etre collecte.

        Typiquement un domaine enregistre mais inactif (expire, parke, en
        vente) : le DNS ne resout pas, donc ni rank, ni backlinks, ni pays.
        C'est le cas NOMINAL pour un domaine qu'on envisage de racheter, mais
        le modele de risque n'a ete entraine que sur des domaines actifs : il
        y voit systematiquement une menace. On refuse donc de trancher.
        """
        return (
            data.rank is None
            and data.backlinks_total is None
            and not data.ns_server_count
        )

    def decide(self, data: DecisionMatrixInput) -> DecisionResult:
        malicious_prob = float(np.clip(data.malicious_prob, 0.0, 1.0))

        if self._signals_are_insufficient(data):
            return self._build_insufficient_data(data)

        rank_norm = _normalize_rank(data.rank)
        backlinks_norm = _normalize_backlinks(data.backlinks_total)
        age_norm = _normalize_age(data.domain_age_days)

       
        authority = float(np.clip(
            self.w_rank * rank_norm +
            self.w_backlinks * backlinks_norm +
            self.w_age * age_norm,
            0.0, 1.0
        ))

        
        email_was_missing = data.email_health_prob is None
        email_health = 0.0 if email_was_missing else float(
            np.clip(data.email_health_prob, 0.0, 1.0)
        )

        # Sans CSV de warm-up, le modele email n'a pas tourne : c'est une
        # donnee ABSENTE, pas une reputation nulle. La compter comme un zero
        # reviendrait a plafonner le score a `authority_weight` (0.5), rendant
        # le seuil "achat recommande" (0.60) mathematiquement inatteignable —
        # meme un domaine parfait finirait "risque". On renormalise donc sur la
        # seule composante disponible.
        if email_was_missing:
            base_score = authority
        else:
            base_score = (
                self.authority_weight * authority +
                self.email_weight * email_health
            )

        # Veto securite : applique APRES le calcul des composantes, pour que
        # l'autorite et la sante email reellement mesurees restent visibles
        # dans le rapport. Les evaluer d'abord puis les remettre a zero
        # donnerait l'impression qu'elles n'ont pas ete calculees du tout.
        if malicious_prob >= self.malicious_threshold:
            return self._build_dangerous(
                malicious_prob, authority, email_health, email_was_missing,
                rank_norm, backlinks_norm, age_norm,
            )

      
        security_factor = 1.0 - malicious_prob
        final_score = base_score * security_factor

        
        return self._resolve_verdict(
            malicious_prob, authority, email_health,
            email_was_missing, base_score, security_factor, final_score,
            rank_norm, backlinks_norm, age_norm,
        )

    def _build_insufficient_data(self, data: DecisionMatrixInput) -> DecisionResult:
        email_was_missing = data.email_health_prob is None
        email_health = 0.0 if email_was_missing else float(
            np.clip(data.email_health_prob, 0.0, 1.0)
        )
        # `malicious_prob` est volontairement remis a 0 : la valeur produite par
        # le modele dans ce cas n'a pas de sens (extrapolation hors domaine
        # d'entrainement), et l'exposer donnerait un faux score de risque.
        # `analysis_service` la traduit en risk_score=None cote API.
        return DecisionResult(
            verdict=Verdict.INSUFFICIENT_DATA,
            verdict_label="DONNÉES INSUFFISANTES",
            verdict_color="#6b7280",
            hard_veto=False,
            confidence=0.0,
            malicious_prob=0.0,
            authority_score=0.0,
            email_health_score=round(email_health, 4),
            email_was_missing=email_was_missing,
            base_value_score=0.0,
            security_factor=0.0,
            final_score=0.0,
            reason=(
                "Le domaine ne répond pas en DNS : ni classement, ni backlinks, "
                "ni pays d'hébergement n'ont pu être mesurés. C'est courant pour "
                "un domaine expiré ou en vente, mais il n'y a alors aucun signal "
                "sur lequel fonder un verdict."
            ),
            recommendation=(
                "Vérifier manuellement l'historique du domaine (archives web, "
                "propriétaire précédent) avant toute décision."
            ),
            breakdown={"insufficient_reason": "no_external_signal_available"},
        )

    def _build_dangerous(
        self,
        malicious_prob: float,
        authority: float = 0.0,
        email_health: float = 0.0,
        email_was_missing: bool = True,
        rank_norm: float = 0.0,
        backlinks_norm: float = 0.0,
        age_norm: float = 0.0,
    ) -> DecisionResult:
        # `final_score` reste a 0 (le veto prime sur toute valeur SEO/email),
        # mais les composantes mesurees sont conservees telles quelles pour
        # que l'utilisateur voie POURQUOI le domaine est rejete malgre, par
        # exemple, un bon historique de warm-up.
        return DecisionResult(
            verdict=Verdict.DANGEROUS,
            verdict_label="DANGEREUX",
            verdict_color="#ef4444",
            hard_veto=True,
            confidence=malicious_prob,
            malicious_prob=round(malicious_prob, 4),
            authority_score=round(authority, 4),
            email_health_score=round(email_health, 4),
            email_was_missing=email_was_missing,
            base_value_score=0.0,
            security_factor=round(1.0 - malicious_prob, 4),
            final_score=0.0,
            reason="Modèle 1 : risque malveillant confirmé (≥ 50%).",
            recommendation="REJETER IMMÉDIATEMENT.",
            breakdown={
                "veto_reason": "malicious_prob_above_threshold",
                "rank_norm": round(rank_norm, 4),
                "backlinks_norm": round(backlinks_norm, 4),
                "age_norm": round(age_norm, 4),
            },
        )

    def _resolve_verdict(
        self,
        malicious_prob: float,
        authority: float,
        email_health: float,
        email_was_missing: bool,
        base_score: float,
        security_factor: float,
        final_score: float,
        rank_norm: float,
        backlinks_norm: float,
        age_norm: float,
    ) -> DecisionResult:

        if final_score >= self.worth_buying_threshold:
            verdict = Verdict.WORTH_BUYING
            label = "ACHAT RECOMMANDÉ"
            color = "#22c55e"
            if email_was_missing:
                # Le score ne repose que sur l'autorité + la sécurité : le dire
                # plutôt que de laisser croire que l'email a été évalué.
                reason = (
                    "Bonne autorité SEO et faible risque sécurité. "
                    "Réputation email non évaluée (aucun fichier de warm-up)."
                )
                recommendation = (
                    "Acheter, mais fournir un historique de warm-up pour "
                    "valider la réputation d'envoi."
                )
            else:
                reason = "Bonne valeur SEO/email avec faible risque sécurité."
                recommendation = (
                    "Acheter. Excellent profil SEO/email avec faible risque."
                    if malicious_prob < 0.20 else
                    "Achat possible mais surveiller (suspicion modérée)."
                )

        elif final_score >= self.risky_threshold:
            verdict = Verdict.RISKY
            label = "RISQUÉ"
            color = "#f59e0b"
            if email_was_missing:
                reason = "Données email absentes. Impossible d'évaluer la réputation d'envoi."
                recommendation = "Vérifier manuellement la réputation email avant achat."
            elif malicious_prob > 0.30:
                reason = f"Suspicion élevée ({malicious_prob:.0%}) pénalise fortement le score."
                recommendation = "Éviter ou négocier fortement."
            elif authority < 0.30:
                reason = "Autorité SEO faible."
                recommendation = "Négocier prix bas. ROI incertain."
            elif email_health < 0.30:
                reason = "Bonne autorité mais réputation email fragile."
                recommendation = "Prévoir warmup long (45-60 jours)."
            else:
                reason = "Score global moyen."
                recommendation = "Évaluer au cas par cas."

        else:
            verdict = Verdict.NOT_WORTH_IT
            label = "PAS RENTABLE"
            color = "#6b7280"
            reason = "Valeur globale trop faible (SEO + Email + Sécurité)."
            recommendation = "Passer. Pas assez de valeur."

        distances = [
            abs(final_score - self.worth_buying_threshold),
            abs(final_score - self.risky_threshold),
            abs(final_score - 0.0),
            abs(final_score - 1.0),
        ]
        confidence = float(np.clip(1.0 - min(distances), 0.0, 1.0))

        return DecisionResult(
            verdict=verdict,
            verdict_label=label,
            verdict_color=color,
            hard_veto=False,
            confidence=round(confidence, 4),
            malicious_prob=round(malicious_prob, 4),
            authority_score=round(authority, 4),
            email_health_score=round(email_health, 4),
            email_was_missing=email_was_missing,
            base_value_score=round(base_score, 4),
            security_factor=round(security_factor, 4),
            final_score=round(final_score, 4),
            reason=reason,
            recommendation=recommendation,
            breakdown={
                "rank_norm": round(rank_norm, 4),
                "backlinks_norm": round(backlinks_norm, 4),
                "age_norm": round(age_norm, 4),
                "authority_contrib": round(self.authority_weight * authority, 4),
                "email_contrib": round(self.email_weight * email_health, 4),
                "base_value": round(base_score, 4),
                "security_penalty_pct": f"-{int(malicious_prob * 100)}%",
                "final_value": round(final_score, 4),
            },
        )

_decision_matrix: DecisionMatrix | None = None

def get_decision_matrix() -> DecisionMatrix:
    global _decision_matrix
    if _decision_matrix is None:
        _decision_matrix = DecisionMatrix()
    return _decision_matrix