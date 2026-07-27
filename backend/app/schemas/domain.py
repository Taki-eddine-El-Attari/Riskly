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