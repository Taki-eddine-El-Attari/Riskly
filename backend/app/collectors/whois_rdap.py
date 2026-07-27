from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
from app.collectors.base import BaseCollector
 
IANA_RDAP_BOOTSTRAP_URL = "https://rdap.org/domain"
 
class WhoisResult(BaseModel):
    domain_name: str
    whois_creation_date: Optional[date] = None
    whois_expiration_date: Optional[date] = None
    country: Optional[str] = None
    registrar: Optional[str] = None
 
 
class WhoisCollector(BaseCollector):
    source_name = "whois_rdap"
    def fetch(self, domain_name: str) -> WhoisResult:

        url = f"{IANA_RDAP_BOOTSTRAP_URL}/{domain_name}"
        response = self._request("GET", url)
        data = response.json()
 
        return WhoisResult(
            domain_name=domain_name,
            whois_creation_date=self._extract_event_date(data, "registration"),
            whois_expiration_date=self._extract_event_date(data, "expiration"),
            country=self._extract_country(data),
            registrar=self._extract_registrar(data),
        )
 
    @staticmethod
    def _extract_event_date(data: dict, event_action: str) -> Optional[date]:
        for event in data.get("events", []):
            if event.get("eventAction") == event_action:
                raw_date = event.get("eventDate")
                if raw_date:
                    return datetime.fromisoformat(raw_date.replace("Z", "+00:00")).date()
        return None
 
    @staticmethod
    def _extract_country(data: dict) -> Optional[str]:
        for entity in data.get("entities", []):
            vcard = entity.get("vcardArray")
            if not vcard or len(vcard) < 2:
                continue
            for field in vcard[1]:
                if field[0] == "adr" and isinstance(field[3], list) and len(field[3]) >= 7:
                    return field[3][6] or None
        return None
 
    @staticmethod
    def _extract_registrar(data: dict) -> Optional[str]:
        for entity in data.get("entities", []):
            if "registrar" in entity.get("roles", []):
                return entity.get("handle")
        return None
 