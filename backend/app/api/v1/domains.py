import datetime
from functools import wraps
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_authenticated, require_admin
from app.core.exceptions import LimiteConcurrenceAtteinteError
from app.models.user import User
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.domain_repo import DomainRepository
from app.schemas.analysis import AnalysisOut
from app.schemas.domain import DomainOut, DomainList, DomainWithLatestMetric, DomainMetricOut
from app.services import analysis_service
from datetime import datetime, timedelta


analyses_router = APIRouter(prefix="/analyses", tags=["analyses"])
domains_router = APIRouter(prefix="/domains", tags=["domains"])

class _EndpointLruCache:
   def __init__(self, maxsize: int = 64, ttl_seconds: int = 60):
        self._cache: dict[str, tuple[any, datetime]] = {}
        self._maxsize = maxsize
        self._ttl = timedelta(seconds=ttl_seconds)
   def _now(self) -> datetime:
       return datetime.utcnow()
   def _is_expired(self, timestamp: datetime) -> bool:
        return (self._now() - timestamp) > self._ttl

   def _evict_if_needed(self) -> None:
        expired = [k for k, (_, ts) in self._cache.items() if self._is_expired(ts)]
        for k in expired:
            del self._cache[k]
        if len(self._cache) > self._maxsize:
            oldest = next(iter(self._cache))
            del self._cache[oldest]

   def get(self, key: str) -> Optional[any]:
        self._evict_if_needed()
        entry = self._cache.get(key)
        if entry is None:
            return None
        value, timestamp = entry
        if self._is_expired(timestamp):
            del self._cache[key]
            return None
        del self._cache[key]
        self._cache[key] = (value, self._now())
        return value

   def set(self, key: str, value: "any") -> None:
        self._evict_if_needed()
        self._cache[key] = (value, self._now())

   def invalidate(self, pattern: str = "") -> None:
       keys = [k for k in self._cache.keys() if pattern in k]
       for k in keys:
           del self._cache[k]

   def clear(self) -> None:
        self._cache.clear()

_domain_cache = _EndpointLruCache(maxsize=64, ttl_seconds=60)

def cached_endpoint(cache_key_func, ttl: int = 60):

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = cache_key_func(*args, **kwargs)
            cached = _domain_cache.get(key)
            if cached is not None:
                return cached
            result = await func(*args, **kwargs)
            _domain_cache._cache[key] = (result, datetime.utcnow())
            return result
        return wrapper
    return decorator

       

@analyses_router.post("", response_model=AnalysisOut, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalysisOut:
    # Le front envoie du JSON quand aucun CSV de warm-up n'est joint, et du
    # multipart/form-data uniquement quand un fichier est present (cf.
    # analyses.api.ts::createAnalysis). Un seul endpoint doit donc accepter
    # les deux formats plutot que de forcer Form(...)/File(...).
    content_type = request.headers.get("content-type", "")
    warmup_csv: Optional[UploadFile] = None

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        domain_name = form.get("domain_name")
        candidate = form.get("warmup_csv")
        # `request.form()` renvoie un `starlette.datastructures.UploadFile`,
        # pas un `fastapi.UploadFile` (qui en est une sous-classe) : un
        # `isinstance(candidate, UploadFile)` avec le UploadFile de fastapi
        # est TOUJOURS faux ici, meme quand un vrai fichier est joint — d'ou
        # le duck-typing sur `.filename` plutot qu'un isinstance.
        if hasattr(candidate, "filename") and candidate.filename:
            warmup_csv = candidate
    else:
        try:
            body = await request.json()
        except Exception:
            body = {}
        domain_name = (body or {}).get("domain_name")

    if not domain_name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "domain_name est requis")

    try:
        analysis = await analysis_service.analyze_domain(
            db,
            domain_name=domain_name,
            user_id=current_user.id,
            warmup_file=warmup_csv,
        )
    except LimiteConcurrenceAtteinteError as e:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Limite de {e.max_concurrent} analyses simultanees atteinte",
        )
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
    cached_key = f"list_domains:page={page}:page_size={page_size}"
    cached = _domain_cache.get(cached_key)
    if cached is not None:
        return cached
    
    repo = DomainRepository(db)
    items = repo.get_all(skip=(page - 1) * page_size, limit=page_size)
    total = repo.count()
    result = DomainList(
        items=[DomainOut.model_validate(d) for d in items],
        total=total,
        page=page,
        page_size=page_size,   
    )
    _domain_cache.set(cached_key, result)
    return result

@domains_router.get("/search")
async def search_domains(
    q: str = Query(..., min_length=1, max_length=255),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> dict:
    cached_key = f"search_domains:q={q}:limit={limit}"
    cached = _domain_cache.get(cached_key)
    if cached is not None:
        return cached
    
    repo = DomainRepository(db)
    results = repo.search_by_name(q, limit=limit)
    result = {
        "query": q,
        "results": [DomainOut.model_validate(d) for d in results],
        "count": len(results),
    }
    _domain_cache.set(cached_key, result)
    return result

@domains_router.get("/stats/tld-distribution")
async def get_tld_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict:
    cached_key = "tld_distribution"
    cached = _domain_cache.get(cached_key)
    if cached is not None:
        return cached
    repo = DomainRepository(db)
    result = repo.get_tld_distribution()

    _domain_cache.set(cached_key, result)
    return result


@domains_router.get("/stats/recent")
async def get_recent_domains(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> list[DomainOut]:
    cached_key = f"recent_domains:limit={limit}"
    cached = _domain_cache.get(cached_key)
    if cached is not None:
        return cached
    repo = DomainRepository(db)
    results = repo.get_recent_domains(limit=limit)
    result = [DomainOut.model_validate(d) for d in results]
    _domain_cache.set(cached_key, result)
    return result

@domains_router.get("/{domain_id}", response_model=DomainOut)
async def get_domain(
    domain_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> DomainOut:
    cached_key = f"domain:{domain_id}"
    cached = _domain_cache.get(cached_key)
    if cached is not None:
        return cached
    repo = DomainRepository(db)
    domain = repo.get_by_id(domain_id)

    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domaine non trouve")

    result = DomainOut.model_validate(domain)
    _domain_cache.set(cached_key, result)
    return result

@domains_router.get("/{domain_id}/with-metric", response_model=DomainWithLatestMetric)
async def get_domain_with_metric(
    domain_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> DomainWithLatestMetric:
    cached_key = f"domain_with_metric:{domain_id}"
    cached = _domain_cache.get(cached_key)
    if cached is not None:
        return cached
    repo = DomainRepository(db)
    domain = repo.get_with_latest_metric(domain_id)

    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domaine non trouve")

    repo = DomainRepository(db)
    domain = repo.get_with_latest_metric(domain_id)

    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domaine non trouve")
    

    latest = domain.metrics[0] if domain.metrics else None
    result = DomainWithLatestMetric.model_validate(domain)
    result.latest_metric = DomainMetricOut.model_validate(latest) if latest else None
    _domain_cache.set(cached_key, result)
    return result

@domains_router.get("/{domain_id}/metrics")
async def get_domain_metrics(
    domain_id: UUID,
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated),
) -> dict:
    cached_key = f"domain_metrics:{domain_id}:limit={limit}"
    cached = _domain_cache.get(cached_key)
    if cached is not None:
        return cached
    repo = DomainRepository(db)
    domain = repo.get_with_all_metrics(domain_id)

    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domaine non trouve")

    metrics = sorted(domain.metrics, key=lambda m: m.calculated_at, reverse=True)[:limit]
    result = {
        "domain_id": str(domain_id),
        "metrics": [DomainMetricOut.model_validate(m) for m in metrics],
        "count": len(metrics),
    }
    _domain_cache.set(cached_key, result)
    return result

@domains_router.post("/admin/cache/clear")
async def clear_domain_cache(
    current_user: User = Depends(require_admin),
) -> dict:
    
    _domain_cache.clear()
    return {"message": "Cache vide", "timestamp": datetime.utcnow().isoformat()}


@domains_router.get("/admin/cache/stats")
async def get_domain_cache_stats(
    current_user: User = Depends(require_admin),
) -> dict:
    
    return {
        "size": len(_domain_cache._cache),
        "maxsize": _domain_cache._maxsize,
        "ttl_seconds": _domain_cache._ttl.total_seconds(),
        "keys": list(_domain_cache._cache.keys())[:20],
    }