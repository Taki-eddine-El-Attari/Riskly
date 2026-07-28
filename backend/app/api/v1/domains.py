from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_authenticated, require_admin
from app.core.exceptions import LimiteConcurrenceAtteinteError
from app.models.user import User
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.domain_repo import DomainRepository
from app.schemas.analysis import AnalysisCreate, AnalysisOut
from app.schemas.domain import DomainOut, DomainList, DomainWithLatestMetric, DomainMetricOut
from app.services import analysis_service

analyses_router = APIRouter(prefix="/analyses", tags=["analyses"])
domains_router = APIRouter(prefix="/domains", tags=["domains"])

@analyses_router.post("/analyses", response_model=AnalysisOut, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    payload: AnalysisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisOut:
    try :
        analysis = await analysis_service.analyze_domain(
            db, domain_name= payload.domain_name , user_id=current_user.id
        )
    except LimiteConcurrenceAtteinteError as e:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUEST,
            f"Limite de {e.limite} analyses simultanees atteinte",
        )   
    return AnalysisOut.model_validate(analysis) 

@analyses_router.get("/{analysis_id}", response_model=AnalysisOut)
async def get_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisOut:
    repo = AnalysisRepository(db)
    analysis = repo.get_by_id(analysis_id)

    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analyse introuvable")
    if current_user.role == "user" and str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")

    return AnalysisOut.model_validate(analysis)

@analyses_router.get("/{analysis_id}/status")
async def get_analysis_status(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    repo = AnalysisRepository(db)
    analysis = repo.get_by_id(analysis_id)

    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analyse introuvable")
    if current_user.role == "user" and str(analysis.user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse")

    return {"id": str(analysis.id), "status": analysis.status}

@domains_router.get("", response_model=DomainList)
async def list_domains(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),   
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> DomainList:
    repo = DomainRepository(db)
    items = repo.get_all(skip=(page - 1) * page_size, limit=page_size)
    total = repo.count()
    return DomainList(
        items=[DomainOut.model_validate(d) for d in items],
        total=total,
        page=page,
        page_size=page_size,   
    )

@domains_router.get("/search")
async def search_domains(
    q: str = Query(..., min_length=1, max_length=255),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> dict:
    repo = DomainRepository(db)
    results = repo.search_by_name(q, limit=limit)
    return {
        "query": q,
        "results": [DomainOut.model_validate(d) for d in results],
        "count": len(results),
    }

@domains_router.get("/stats/tld-distribution")
async def get_tld_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict:
    repo = DomainRepository(db)
    return repo.get_tld_distribution()


@domains_router.get("/stats/recent")
async def get_recent_domains(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> list[DomainOut]:
    repo = DomainRepository(db)
    results = repo.get_recent_domains(limit=limit)
    return [DomainOut.model_validate(d) for d in results]

@domains_router.get("/{domain_id}", response_model=DomainOut)
async def get_domain(
    domain_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> DomainOut:
    repo = DomainRepository(db)
    domain = repo.get_by_id(domain_id)

    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domaine non trouve")

    return DomainOut.model_validate(domain)

@domains_router.get("/{domain_id}/with-metric", response_model=DomainWithLatestMetric)
async def get_domain_with_metric(
    domain_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> DomainWithLatestMetric:
    repo = DomainRepository(db)
    domain = repo.get_with_latest_metric(domain_id)

    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domaine non trouve")

    latest = domain.metrics[0] if domain.metrics else None
    result = DomainWithLatestMetric.model_validate(domain)
    result.latest_metric = DomainMetricOut.model_validate(latest) if latest else None
    return result

@domains_router.get("/{domain_id}/metrics")
async def get_domain_metrics(
    domain_id: UUID,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> dict:
    repo = DomainRepository(db)
    domain = repo.get_with_all_metrics(domain_id)

    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domaine non trouve")

    metrics = sorted(domain.metrics, key=lambda m: m.calculated_at, reverse=True)[:limit]
    return {
        "domain_id": str(domain_id),
        "metrics": [DomainMetricOut.model_validate(m) for m in metrics],
        "count": len(metrics),
    }