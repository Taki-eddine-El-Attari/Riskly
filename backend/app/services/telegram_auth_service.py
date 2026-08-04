import hashlib
import hmac
import time
import json
import urllib.request
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User
from app.repositories.user_repo import UserRepository

class TelegramAuthService:

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)

    def verify_telegram_auth(self, auth_data: dict) -> bool:
        received_hash = auth_data.pop("hash", None)
        if not received_hash:
            return False
        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(auth_data.items()) if v is not None
        )

        secret_key = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()

        expected_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_hash, received_hash):
            return False

        auth_date = int(auth_data.get("auth_date", 0))

        if time.time() - auth_date > 86_400:
            return False

        return True

    def _fetch_telegram_profile_photo(self, telegram_id: int) -> Optional[str]:
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            return None
        base = f"https://api.telegram.org/bot{token}"
        try:
            url = f"{base}/getUserProfilePhotos?user_id={telegram_id}&limit=1"
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.load(resp)
            if not data.get("ok") or data["result"].get("total_count", 0) == 0:
                return None
            photos = data["result"].get("photos", [])
            if not photos:
                return None
            file_id = photos[0][-1]["file_id"]
            with urllib.request.urlopen(f"{base}/getFile?file_id={file_id}", timeout=10) as resp:
                file_data = json.load(resp)
            if not file_data.get("ok"):
                return None
            file_path = file_data["result"].get("file_path")
            if not file_path:
                return None
            file_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
            return file_url
        except Exception:
            return None

    def authenticate(self, telegram_data: dict) -> User:
        if not self.verify_telegram_auth(telegram_data.copy()):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Données Telegram invalides",
            )

        telegram_id = telegram_data.get("id")
        username = telegram_data.get("username") or telegram_data.get("first_name")
        photo_url = telegram_data.get("photo_url")

        existing = self.db.query(User).filter(User.telegram_id == telegram_id).first()

        if existing:
            if not existing.photo_url and not photo_url:
                fetched = self._fetch_telegram_profile_photo(telegram_id)
                if fetched:
                    existing.photo_url = fetched
                    self.db.add(existing)
                    self.db.commit()
                    self.db.refresh(existing)
            elif photo_url and existing.photo_url != photo_url:
                existing.photo_url = photo_url
                self.db.add(existing)
                self.db.commit()
                self.db.refresh(existing)
            return existing

        name = username or f"tg_user_{telegram_id}"

        if not photo_url:
            photo_url = self._fetch_telegram_profile_photo(telegram_id)

        user = User(
            username=name,
            telegram_id=telegram_id,
            telegram_username=username,
            photo_url=photo_url,
            password_hash=None,
            role="user",
        )

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user


           