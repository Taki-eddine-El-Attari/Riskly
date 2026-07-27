import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, field_validator

class UserRole(str, Enum):
    superadmin = "superadmin"
    admin = "admin"
    user = "user"


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not any(char.isdigit() for char in value):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre.")
        if not any(char.isupper() for char in value):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule.")
        return value


class UserLogin(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=1)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True) 
    id: uuid.UUID
    name: str
    role: UserRole
    created_at: datetime
   

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):

    sub: uuid.UUID 
    exp: datetime