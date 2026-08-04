from uuid import UUID
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories import warmup_repo
from app.services import warmup_storage_service as storage
from app.schemas.analysis import (
    AnalysisSummary,
    AnalysisOut,
    AnalysisList,
    VerdictFilter,
    VERDICT_FILTER_TO_STORED,
)
from app.schemas.warmup import WarmupSummary

router = APIRouter(prefix="/analyses", tags=["analyses"])

@router.get("", response_model=AnalysisList)
async def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: Literal[
        "requested_at", "risk_score", "authority_score", "profitability_score"
    ] = Query("requested_at"),
    order: Literal["asc", "desc"] = Query("desc"),
    verdict: Optional[VerdictFilter] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisList:
     repo = AnalysisRepository(db)
     verdict_value = VERDICT_FILTER_TO_STORED[verdict].value if verdict else None
     analyses = repo.get_by_user(
        user_id=current_user.id, skip=(page - 1) * page_size, limit=page_size,
        sort_by=sort_by, order=order, verdict=verdict_value,
    )
     total = repo.count_by_user(current_user.id, verdict=verdict_value)

     items = [
            AnalysisSummary(
                id=a.id, domain_name=a.domain.domain_name if a.domain else "",
                risk_score=a.risk_score, authority_score=a.authority_score,
                profitability_score=a.profitability_score,
                email_health_score=a.email_health_score,
                verdict=a.verdict, requested_at=a.requested_at, status=a.status,
                warmup=WarmupSummary.model_validate(a.warmup_file) if a.warmup_file else None,
            )
            for a in analyses
        ]
     return AnalysisList(items=items, total=total, page=page, page_size=page_size)

@router.get("/stats/overview")
async def get_personal_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    
    repo = AnalysisRepository(db)
    return {
        "total": repo.count_by_user(current_user.id),
        "by_verdict": repo.get_verdict_breakdown(current_user.id),
        "last_30_days": repo.count_last_30_days(current_user.id),
    }


@router.get("/admin/all", response_model=AnalysisList)
async def get_all_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[UUID] = Query(None, description="Filtrer par utilisateur"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> AnalysisList:
    repo = AnalysisRepository(db)
    analyses = repo.get_all(skip=(page - 1) * page_size, limit=page_size, user_id=user_id)
    total = repo.count_all(user_id=user_id)

    items = [
        AnalysisSummary(
            id=a.id, domain_name=a.domain.domain_name if a.domain else "",
            risk_score=a.risk_score, authority_score=a.authority_score,
            verdict=a.verdict, requested_at=a.requested_at, status=a.status,
            warmup=WarmupSummary.model_validate(a.warmup_file) if a.warmup_file else None,
        )
        for a in analyses
    ]
    return AnalysisList(items=items, total=total, page=page, page_size=page_size)


@router.get("/{analysis_id}", response_model=AnalysisOut)
async def get_analysis_detail(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisOut:
    repo = AnalysisRepository(db)
    analysis = repo.get_by_id(analysis_id)

    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analyse non trouvee")
    if str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous n'avez pas acces a cette analyse")

    return AnalysisOut.model_validate(analysis)


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    repo = AnalysisRepository(db)
    analysis = repo.get_by_id(analysis_id)

    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analyse non trouvee")
    if str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous ne pouvez pas supprimer cette analyse")

    # Le fichier de warm-up cascade en base avec l'analyse, mais son contenu
    # sur le volume de stockage doit être nettoyé explicitement.
    warmup = warmup_repo.get_warmup_by_analysis(db, analysis_id)
    object_key = warmup.object_key if warmup is not None else None

    repo.delete(analysis_id)
    if object_key is not None:
        storage.delete_warmup(object_key)
    return None