import uuid
from sqlalchemy import Column, String, DateTime, CheckConstraint , event, BigInteger, text
from sqlalchemy.dialects.postgresql import  UUID
from sqlalchemy.orm import relationship , validates
from sqlalchemy.sql import func
from app.models.base import Base

class User(Base):
    __tablename__= "users"
    __table_args__ =(
        CheckConstraint(
            "role IN ('superadmin','admin','user')",
            name="check_valid_role",
        ),
        CheckConstraint(
            "auth_method IN ('local','telegram')",
            name="check_valid_auth_method"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True , default=uuid.uuid4)

    username = Column(String(255) ,unique=True, nullable=False)

    password_hash= Column(String(255), nullable = True)

    auth_method = Column(String(20), nullable=False, default='local', server_default='local')

    telegram_id=Column(BigInteger , unique=True, nullable=True,index=True)

    telegram_username =Column(String(100) ,nullable=True)

    photo_url = Column(String(1024), nullable=True)


    role= Column(String(50), default='user')

    entite = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analyses=relationship("Analysis", back_populates="user")


    @validates("role")
    def validate_role(self,key, role):
        allowed = { "superadmin" , "admin" ,"user"}
        if role not in allowed:
            raise ValueError(f"role invalide {role}. Attendu :{','.join(allowed)}")
        return role 

    @property

    def is_telegram_user(self)-> bool:
        return self.auth_method == "telegram" and self.telegram_id is not None

@event.listens_for(User, "before_insert")
def enforce_single_superadmin_insert(mapper, connection, target):
    if target.role == "superadmin":
        existing = connection.execute(
            text('SELECT 1 FROM "users" WHERE role = :role LIMIT 1'),
            {"role": "superadmin"}
        ).fetchone()
        if existing:
            raise ValueError("Un superadmin existe déjà. Supprimez-le d'abord.")


@event.listens_for(User, "before_update")

def enforce_single_superadmin(mapper , connection , target):

    if target.role == "superadmin":
        existing = connection.execute(
            User.__table__.select().where(
                User.__table__.c.role == "superadmin",
                User.__table__.c.id != target.id,
            )
        ).fetchone()
        if existing :
            raise ValueError("Un superAdmin existe déjà")