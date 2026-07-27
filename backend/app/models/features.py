import uuid 
from sqlalchemy import Column , String , Integer ,DateTime , ForeignKey , JSON , DECIMAL , Boolean
from sqlalchemy.dialects.postgresql import UUID ,JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class DomainMetric(Base):

    __tablename__ = "domain_metric"

    domain_id = Column(UUID(as_uuid=True), primary_key=True , default=uuid.uuid4)

    domain_id=Column(
        UUID(as_uuid=True),
        ForeignKey("domain.id", ondelete="CASCADE"),
        nullable=False,
    )

    is_blacklisted = Column(Boolean , default=False)

    rank_value= Column(DECIMAL(10,2))

    rank_source = Column(String(100))

    referring_domains_count= Column(Integer , default=0)

    backlink_ratio= Column(DECIMAL(5 ,2))

    nb_server_count = Column(Integer)

    raw_data= Column(JSONB)

    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    domain = relationship("Domain" , back_populates="metrics")
    analyses = relationship("Analysis" ,back_populates="domain_metric")
