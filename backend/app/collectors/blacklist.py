from datetime import date
from typing import List, Optional
import dns.exception
import dns.resolver
from pydantic import BaseModel
from app.collectors.base import BaseCollector
from app.core.config import settings
 
DNSBL_ZONES = [
    "dbl.spamhaus.org",
    "multi.surbl.org",
]
 
class BlacklistDetection(BaseModel):
    source: str
    event_type: str = "blacklisted"
    reason: Optional[str] = None
    detection_date: date
 
 
class BlacklistResult(BaseModel):
    domain_name: str
    is_blacklisted: bool
    detections: List[BlacklistDetection] = []
 
 
class BlacklistCollector(BaseCollector):
    source_name = "blacklist_dnsbl"
 
    def fetch(self, domain_name: str) -> BlacklistResult:
        detections: List[BlacklistDetection] = []
 
        for zone in DNSBL_ZONES:
            detection = self._check_zone(domain_name, zone)
            if detection is not None:
                detections.append(detection)
 
        return BlacklistResult(
            domain_name=domain_name,
            is_blacklisted=len(detections) > 0,
            detections=detections,
        )
 
    def _check_zone(self, domain_name: str, zone: str) -> Optional[BlacklistDetection]:
        query = f"{domain_name}.{zone}"
        resolver = dns.resolver.Resolver()
        resolver.timeout = settings.EXTERNAL_API_TIMEOUT_SECONDS
        resolver.lifetime = settings.EXTERNAL_API_TIMEOUT_SECONDS
 
        try:
            resolver.resolve(query, "A")
        except dns.resolver.NXDOMAIN:
            return None
        except dns.exception.Timeout:
            return None
 
        return BlacklistDetection(
            source=zone,
            reason=f"Domaine listé sur {zone}",
            detection_date=date.today(),
        )