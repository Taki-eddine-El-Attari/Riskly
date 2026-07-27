import httpx
from dataclasses import dataclass
from typing import Optional
from app.core.config import settings
from app.core.exceptions import CollectorError, CollectorTimeout, CollectorRateLimit


@dataclass
class BacklinkProfile:
    
    referring_domains_count: Optional[int] = None
    toxic_backlink_ratio: Optional[float] = None
    backlink_count: Optional[int] = None
    quality_estimate: Optional[float] = None
    source: Optional[str] = None
    raw_response: Optional[dict] = None


class BacklinksCollector:
    OPENPAGERANK_URL = "https://openpagerank.com/api/v1.0/getPageRank"
    TIMEOUT_SECONDS = 10.0

    def __init__(self):
        self.api_key = settings.OPEN_PAGERANK_API_KEY or ""

    async def collect(self, domain: str) -> BacklinkProfile:
        try:
            return await self._fetch_openpagerank(domain)
        except (CollectorTimeout, CollectorRateLimit, CollectorError) as e:
            print(f"[BacklinksCollector] echec pour {domain}: {e}")

        return BacklinkProfile(raw_response={"error": "Collecte backlinks echouee"})

    async def _fetch_openpagerank(self, domain: str) -> BacklinkProfile:
        if not self.api_key:
            raise CollectorError("OpenPageRank", "Cle API non configuree")

        headers = {"API-OPR": self.api_key}
        params = {"domains[]": domain}

        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT_SECONDS) as client:
                response = await client.get(
                    self.OPENPAGERANK_URL, headers=headers, params=params
                )

                if response.status_code == 429:
                    raise CollectorRateLimit("OpenPageRank", "Quota depasse")
                if response.status_code >= 500:
                    raise CollectorError(
                        "OpenPageRank", f"Erreur serveur {response.status_code}"
                    )

                response.raise_for_status()
                data = response.json()
                return self._parse_response(data)

        except httpx.TimeoutException:
            raise CollectorTimeout("OpenPageRank", f"Timeout apres {self.TIMEOUT_SECONDS}s")
        except httpx.HTTPStatusError as e:
            raise CollectorError("OpenPageRank", f"HTTP {e.response.status_code}")
        except httpx.RequestError as e:
            raise CollectorError("OpenPageRank", f"Erreur reseau: {e}")

    def _parse_response(self, data: dict) -> BacklinkProfile:
        try:
            results = data.get("response", [])
            if not results:
                return BacklinkProfile(source="OpenPageRank", raw_response=data)

            result = results[0]
            page_rank = float(result.get("page_rank_decimal", 0))

            return BacklinkProfile(
                referring_domains_count=None,
                toxic_backlink_ratio=None,
                backlink_count=None,
                quality_estimate=self._estimate_quality(page_rank),
                source="OpenPageRank",
                raw_response=data,
            )
        except (KeyError, ValueError, TypeError) as e:
            raise CollectorError("OpenPageRank", f"Format inattendu: {e}")

    def _estimate_quality(self, page_rank: float) -> float:
    
        return round(min(page_rank / 10.0, 1.0), 4)