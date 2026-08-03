import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DomainCreate(BaseModel):
    
    domain_name: str


class DomainOut(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    domain_name: str
    tld: Optional[str] = None
    country: Optional[str] = None
    domain_length: Optional[int] = None
    hyphen_count: Optional[int] = None
    whois_creation_date: Optional[date] = None
    whois_expiration_date: Optional[date] = None
    first_analysis: Optional[datetime] = None


class DomainList(BaseModel):
    items: list[DomainOut]
    total: int
    page: int
    page_size: int


class DomainMetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_blacklisted: Optional[bool] = None
    rank_value: Optional[float] = None
    rank_source: Optional[str] = None
    backlink_count: Optional[int] = None
    referring_domains_count: Optional[int] = None
    toxic_backlink_ratio: Optional[float] = None
    nb_server_count: Optional[int] = None
    calculated_at: Optional[datetime] = None


class DomainWithLatestMetric(DomainOut):
    latest_metric: Optional[DomainMetricOut] = None