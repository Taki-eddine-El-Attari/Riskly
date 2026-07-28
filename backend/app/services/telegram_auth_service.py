import hashlib
import hmac
import time
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User
from app.repositories.user_repo import UserRepository

class TelegramAuthService :

    def __init__(self,db : Session):
        self.db=db
        self.user_repo=UserRepository(db)

    def verify_telegram_auth(semf , auth_data : dict )-> bool :
        received_hash = auth_data.pop("hash",None)
        if not received_hash : 
            return False
        data_check_string ="\n".join(
            f"{k}={v}" for k , v in sorted(auth_data.items()) if v is not None 
        )

        secret_key = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()

        expected_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_hash, received_hash):
            return False

        auth_date = int(auth_data.get("auth_data",0))

        if time.time() - auth_date >84600:
            return False

        return True
    def authenticate(self, telegram_data : dict )->User :
        if not self.verify_telegram_auth(telegram_data.copy()):
            raise HTTPException(
                status_code = status.HTTP_401_UNAUTHORIZED,
                detail = "Données Telegram invalides"
            )

        telegram_id = telegram_data.get("id")
        username = telegram_data.get("username") or telegram_data("first_name")

        existing = self.db.query(User).filter(User.telegram_id == telegram_id).first()

        if existing :
            return existing

        name= username or f"tg_user_{telegram_id}"

        user = User(
            name = name,
            telegram_id = telegram_id,
            telegram_usernmae =username,
            password_hash=None,
            role = "membre"
        )

        self.db.add(user)
        self.db.commit()

        self.db.refresh(user)

        return user


           