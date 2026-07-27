

from uuid import UUID
from datetime import date
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.models.domain import Domain
from app.models.features import DomainMetric


class DomainRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        domain_name: str,
        tld: Optional[str] = None,
        country: Optional[str] = None,
        domain_length: Optional[int] = None,
        hyphen_count: Optional[int] = None,
        whois_creation_date: Optional[date] = None,
        whois_expiration_date: Optional[date] = None,
    ) -> Domain:
        
        domain_name = domain_name.lower().strip()

        if self.exists(domain_name):
            raise ValueError(f"Domaine deja existant : {domain_name}")

        domain = Domain(
            domain_name=domain_name,
            tld=tld.lower().strip() if tld else None,
            country=country,
            domain_length=domain_length,
            hyphen_count=hyphen_count,
            whois_creation_date=whois_creation_date,
            whois_expiration_date=whois_expiration_date,
        )
        self.db.add(domain)
        self.db.commit()
        self.db.refresh(domain)
        return domain

    def get_or_create(self, domain_name: str, **kwargs) -> Domain:

        domain_name = domain_name.lower().strip()
        domain = self.get_by_name(domain_name)
        if domain:
            return domain
        return self.create(domain_name=domain_name, **kwargs)

    def get_by_id(self, domain_id: UUID) -> Optional[Domain]:
        return self.db.query(Domain).filter(Domain.id == domain_id).first()

    def get_by_name(self, domain_name: str) -> Optional[Domain]:
        return (
            self.db.query(Domain)
            .filter(Domain.domain_name == domain_name.lower().strip())
            .first()
        )

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Domain]:
        return self.db.query(Domain).offset(skip).limit(limit).all()

    def get_with_latest_metric(self, domain_id: UUID) -> Optional[Domain]:
        domain = (
            self.db.query(Domain)
            .options(joinedload(Domain.metrics))
            .filter(Domain.id == domain_id)
            .first()
        )
        if domain and domain.metrics:
            domain.metrics = sorted(
                domain.metrics, key=lambda m: m.calculated_at, reverse=True
            )[:1]
        return domain

    def get_with_all_metrics(self, domain_id: UUID) -> Optional[Domain]:
        return (
            self.db.query(Domain)
            .options(joinedload(Domain.metrics))
            .filter(Domain.id == domain_id)
            .first()
        )

    def search_by_name(self, query: str, limit: int = 20) -> List[Domain]:
        return (
            self.db.query(Domain)
            .filter(Domain.domain_name.ilike(f"%{query.lower()}%"))
            .limit(limit)
            .all()
        )

    def exists(self, domain_name: str) -> bool:
        return self.get_by_name(domain_name) is not None

    def get_recent_domains(self, limit: int = 10) -> List[Domain]:
        return (
            self.db.query(Domain)
            .order_by(Domain.first_analysis.desc())
            .limit(limit)
            .all()
        )

    def update_static_fields(
        self, domain_id: UUID, tld=None, country=None, domain_length=None,
        hyphen_count=None, whois_creation_date: Optional[date] = None,
        whois_expiration_date: Optional[date] = None,
    ) -> Optional[Domain]:
        domain = self.get_by_id(domain_id)
        if domain is None:
            return None
        if tld is not None: domain.tld = tld
        if country is not None: domain.country = country
        if domain_length is not None: domain.domain_length = domain_length
        if hyphen_count is not None: domain.hyphen_count = hyphen_count
        if whois_creation_date is not None: domain.whois_creation_date = whois_creation_date
        if whois_expiration_date is not None: domain.whois_expiration_date = whois_expiration_date
        self.db.commit()
        self.db.refresh(domain)
        return domain

    def delete(self, domain_id: UUID) -> bool:
        domain = self.get_by_id(domain_id)
        if domain is None:
            return False
        self.db.delete(domain)
        self.db.commit()
        return True

    def count(self) -> int:
        return self.db.query(Domain).count()

    def count_by_tld(self, tld: str) -> int:
        return self.db.query(Domain).filter(Domain.tld == tld.lower()).count()

    def get_tld_distribution(self) -> dict:
        results = (
            self.db.query(Domain.tld, func.count(Domain.id))
            .group_by(Domain.tld)
            .all()
        )
        return {tld: count for tld, count in results}