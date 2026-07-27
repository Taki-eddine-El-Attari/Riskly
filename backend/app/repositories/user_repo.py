from uuid import UUID
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.user import User


class UserRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        username: str,
        password_hash: str,
        role: str = "user",
        entite: Optional[str] = None,
    ) -> User:
        if self.exists(username):
            raise ValueError(f"Username deja utilise : {username}")

        user = User(
            username=username,
            password_hash=password_hash,
            role=role,
            entite=entite,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_by_id(self, user_id: UUID) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[User]:
        return self.db.query(User).offset(skip).limit(limit).all()

    def get_by_role(self, role: str) -> List[User]:
        return self.db.query(User).filter(User.role == role).all()

    def get_superadmin(self) -> Optional[User]:
        return self.db.query(User).filter(User.role == "superadmin").first()

    def exists(self, username: str) -> bool:
        return self.db.query(User).filter(User.username == username).first() is not None

    def update(self, user_id: UUID, **kwargs) -> Optional[User]:
        user = self.get_by_id(user_id)
        if not user:
            return None

        allowed_fields = {"username", "role", "entite", "password_hash"}
        for key, value in kwargs.items():
            if key in allowed_fields:
                setattr(user, key, value)

        self.db.commit()
        self.db.refresh(user)
        return user

    def update_password(self, user_id: UUID, new_password_hash: str) -> bool:
        user = self.get_by_id(user_id)
        if not user:
            return False
        user.password_hash = new_password_hash
        self.db.commit()
        return True

    def delete(self, user_id: UUID) -> bool:
        user = self.get_by_id(user_id)
        if not user:
            return False
        self.db.delete(user)
        self.db.commit()
        return True

    def delete_by_username(self, username: str) -> bool:
        user = self.get_by_username(username)
        if not user:
            return False
        self.db.delete(user)
        self.db.commit()
        return True

    def count(self) -> int:
        return self.db.query(User).count()

    def count_by_role(self, role: str) -> int:
        return self.db.query(User).filter(User.role == role).count()