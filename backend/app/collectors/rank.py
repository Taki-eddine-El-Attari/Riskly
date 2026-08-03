import asyncio
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
class RankData:
    rank_value: Optional[float] = None
    rank_source: Optional[str] = None
    referring_domains: Optional[int] = None
    raw_response: Optional[dict] = None


class RankCollector:
    # API "OpenPageRank" de Keywords Everywhere (PAS domcop.com/openpagerank.com,
    # qui est un service distinct avec un autre format de cle/auth). Confirme
    # via `collect_fe_4.py` (script ayant servi a construire le dataset
    # d'entrainement) : Bearer token + POST JSON, cle au format `opr_live_...`.
    OPENPAGERANK_URL = "https://openpagerank.keywordseverywhere.com/v1/domains/bulk"
    TIMEOUT_SECONDS = 10.0

    def __init__(self):
        self.api_key = settings.OPEN_PAGERANK_API_KEY or ""

    async def collect(self, domain: str) -> RankData:
        try:
            result = await self._fetch_openpagerank(domain)
            logger.info(
                "[RankCollector] %s -> rank=%s referring_domains=%s",
                domain, result.rank_value, result.referring_domains,
            )
            return result
        except ExternalAPIError as e:
            logger.warning("[RankCollector] echec pour %s: %s", domain, e)

        return RankData(
            rank_value=None,
            rank_source=None,
            referring_domains=None,
            raw_response={"error": "Toutes les sources de rank ont echoue"},
        )

    async def _fetch_openpagerank(self, domain: str) -> RankData:
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
                return self._parse_openpagerank_response(data)

        except httpx.TimeoutException:
            raise ExternalAPITimeoutError("OpenPageRank")
        except httpx.HTTPStatusError as e:
            raise ExternalAPIError("OpenPageRank", f"HTTP {e.response.status_code}")
        except httpx.RequestError as e:
            raise ExternalAPIError("OpenPageRank", f"Erreur reseau: {e}")

    def _parse_openpagerank_response(self, data: dict) -> RankData:
        try:
            results = data.get("results", [])
            if not results or not results[0].get("found"):
                return RankData(rank_value=None, rank_source="OpenPageRank", raw_response=data)

            result = results[0]
            return RankData(
                rank_value=float(result.get("open_page_rank", 0)),
                rank_source="OpenPageRank",
                referring_domains=result.get("referring_domains"),
                raw_response=data,
            )
        except (KeyError, ValueError, TypeError, IndexError) as e:
            raise ExternalAPIError("OpenPageRank", f"Format de reponse inattendu: {e}")

    async def collect_batch(self, domains: list[str]) -> dict[str, RankData]:
        """Collecte le rank pour plusieurs domaines en parallele."""
        tasks = [self.collect(d) for d in domains]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return {
            domain: (result if not isinstance(result, Exception)
                     else RankData(raw_response={"error": str(result)}))
            for domain, result in zip(domains, results)
        }