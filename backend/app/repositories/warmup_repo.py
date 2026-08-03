import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.warmup_file import WarmupFile


def create_warmup_file(
    db: Session,
    *,
    analysis_id: uuid.UUID,
    user_id: uuid.UUID,
    original_name: str,
    content_type: Optional[str],
    size_bytes: int,
    rows: Optional[int],
    object_key: str,
    sha256: str,
) -> WarmupFile:
    warmup = WarmupFile(
        analysis_id=analysis_id,
        user_id=user_id,
        original_name=original_name,
        content_type=content_type,
        size_bytes=size_bytes,
        rows=rows,
        object_key=object_key,
        sha256=sha256,
    )
    db.add(warmup)
    db.flush()
    return warmup


def get_warmup_by_id(db: Session, warmup_id: uuid.UUID) -> Optional[WarmupFile]:
    return db.get(WarmupFile, warmup_id)


def get_warmup_by_analysis(db: Session, analysis_id: uuid.UUID) -> Optional[WarmupFile]:
    stmt = select(WarmupFile).where(WarmupFile.analysis_id == analysis_id)
    return db.scalars(stmt).first()


def delete_warmup_file(db: Session, warmup: WarmupFile) -> None:
    db.delete(warmup)
    db.flush()
