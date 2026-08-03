import logging
import httpx
from dataclasses import dataclass
from typing import Optional
from app.core.config import settings
from app.core.exceptions import (
    ExternalAPIError,
    ExternalAPIRateLimitError,
    ExternalAPITimeoutError,
)

logger = logging.getLogger(__name__)


@dataclass
class BacklinkProfile:
    
    referring_domains_count: Optional[int] = None
    toxic_backlink_ratio: Optional[float] = None
    backlink_count: Optional[int] = None
    quality_estimate: Optional[float] = None
    source: Optional[str] = None
    raw_response: Optional[dict] = None


class BacklinksCollector:
    # Meme service que RankCollector (cf. son commentaire) : API "OpenPageRank"
    # de Keywords Everywhere, Bearer token + POST JSON.
    OPENPAGERANK_URL = "https://openpagerank.keywordseverywhere.com/v1/domains/bulk"
    TIMEOUT_SECONDS = 10.0

    def __init__(self):
        self.api_key = settings.OPEN_PAGERANK_API_KEY or ""

    async def collect(self, domain: str) -> BacklinkProfile:
        try:
            result = await self._fetch_openpagerank(domain)
            logger.info(
                "[BacklinksCollector] %s -> backlink_count=%s quality=%s",
                domain, result.backlink_count, result.quality_estimate,
            )
            return result
        except ExternalAPIError as e:
            logger.warning("[BacklinksCollector] echec pour %s: %s", domain, e)

        return BacklinkProfile(raw_response={"error": "Collecte backlinks echouee"})

    async def _fetch_openpagerank(self, domain: str) -> BacklinkProfile:
        if not self.api_key:
            raise ExternalAPIError("OpenPageRank", "Cle API non configuree")

        headers = {"Authorization": f"Bearer {self.api_key}"}

        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT_SECONDS) as client:
                response = await client.post(
                    self.OPENPAGERANK_URL, headers=headers, json={"domains": [domain]}
                )

                if response.status_code == 429:
                    raise ExternalAPIRateLimitError("OpenPageRank")
                if response.status_code >= 500:
                    raise ExternalAPIError(
                        "OpenPageRank", f"Erreur serveur {response.status_code}"
                    )

                response.raise_for_status()
                data = response.json()
                return self._parse_response(data)

        except httpx.TimeoutException:
            raise ExternalAPITimeoutError("OpenPageRank")
        except httpx.HTTPStatusError as e:
            raise ExternalAPIError("OpenPageRank", f"HTTP {e.response.status_code}")
        except httpx.RequestError as e:
            raise ExternalAPIError("OpenPageRank", f"Erreur reseau: {e}")

    def _parse_response(self, data: dict) -> BacklinkProfile:
        try:
            results = data.get("results", [])
            if not results or not results[0].get("found"):
                return BacklinkProfile(source="OpenPageRank", raw_response=data)

            result = results[0]
            page_rank = float(result.get("open_page_rank", 0))
            # `backlink_count` porte le nombre de domaines referents : c'est la
            # semantique de la colonne "backlist" du dataset d'entrainement
            # (cf. collect_fe_4.py : `pagerank_info.get("referring_domains")`),
            # que `feature_builder.py` lit ensuite via la cle "backlink".
            referring_domains = result.get("referring_domains")

            return BacklinkProfile(
                referring_domains_count=referring_domains,
                toxic_backlink_ratio=None,
                backlink_count=referring_domains,
                quality_estimate=self._estimate_quality(page_rank),
                source="OpenPageRank",
                raw_response=data,
            )
        except (KeyError, ValueError, TypeError, IndexError) as e:
            raise ExternalAPIError("OpenPageRank", f"Format inattendu: {e}")

    def _estimate_quality(self, page_rank: float) -> float:
    
        return round(min(page_rank / 10.0, 1.0), 4)