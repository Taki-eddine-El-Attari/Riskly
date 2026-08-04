import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.analysis import Analysis
from app.models.user import User
from app.repositories import warmup_repo
from app.schemas.warmup import WarmupInfo
from app.services import warmup_storage_service as storage

router = APIRouter(prefix="/analyses", tags=["warmup"])

_ADMIN_ROLES = {"admin", "superadmin"}


def _get_owned_analysis(
    analysis_id: uuid.UUID, db: Session, user: User, *, allow_admin: bool
) -> Analysis:
    analysis = db.get(Analysis, analysis_id)
    if analysis is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analyse introuvable.")
    is_owner = str(analysis.user_id) == str(user.id)
    is_admin = allow_admin and user.role in _ADMIN_ROLES
    if not (is_owner or is_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé à cette analyse.")
    return analysis


def _sanitize_filename(name: str) -> str:
    cleaned = "".join(c for c in name if c not in '\r\n"\\').strip()
    return cleaned or "warmup.csv"


@router.post(
    "/{analysis_id}/warmup",
    response_model=WarmupInfo,
    status_code=status.HTTP_201_CREATED,
)
async def upload_warmup(
    analysis_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WarmupInfo:
    analysis = _get_owned_analysis(analysis_id, db, current_user, allow_admin=False)

    if warmup_repo.get_warmup_by_analysis(db, analysis.id) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Un fichier de warm-up est déjà attaché à cette analyse.",
        )

    # Valide + écrit sur le volume privé (peut lever une RisklyException).
    stored = storage.store_warmup(file.file, file.filename or "")

    try:
        warmup = warmup_repo.create_warmup_file(
            db,
            analysis_id=analysis.id,
            user_id=analysis.user_id,
            original_name=(file.filename or "warmup.csv")[:255],
            content_type=file.content_type,
            size_bytes=stored.size_bytes,
            rows=stored.rows,
            object_key=stored.object_key,
            sha256=stored.sha256,
        )
        db.commit()
        db.refresh(warmup)
    except Exception:
        # La ligne n'a pas pu être créée : on ne laisse pas de fichier orphelin.
        db.rollback()
        storage.delete_warmup(stored.object_key)
        raise

    return WarmupInfo.model_validate(warmup)


@router.get("/{analysis_id}/warmup", response_model=WarmupInfo)
async def get_warmup_metadata(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WarmupInfo:
    _get_owned_analysis(analysis_id, db, current_user, allow_admin=True)
    warmup = warmup_repo.get_warmup_by_analysis(db, analysis_id)
    if warmup is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun fichier de warm-up.")
    return WarmupInfo.model_validate(warmup)


@router.get("/{analysis_id}/warmup/download")
async def download_warmup(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    _get_owned_analysis(analysis_id, db, current_user, allow_admin=True)
    warmup = warmup_repo.get_warmup_by_analysis(db, analysis_id)
    if warmup is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun fichier de warm-up.")

    stream = storage.open_warmup(warmup.object_key, expected_sha256=warmup.sha256)
    filename = _sanitize_filename(warmup.original_name)
    return StreamingResponse(
        stream,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.delete("/{analysis_id}/warmup", status_code=status.HTTP_204_NO_CONTENT)
async def delete_warmup(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    _get_owned_analysis(analysis_id, db, current_user, allow_admin=True)
    warmup = warmup_repo.get_warmup_by_analysis(db, analysis_id)
    if warmup is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun fichier de warm-up.")

    object_key = warmup.object_key
    warmup_repo.delete_warmup_file(db, warmup)
    db.commit()
    # Le fichier n'est retiré du disque qu'après la validation en base.
    storage.delete_warmup(object_key)
    return None
