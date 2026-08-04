import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import httpx

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
    raw_response: Optional[dict] = field(default_factory=dict)
    cached: bool = False


class _RankLruCache:
    def __init__(self, maxsize: int = 256, ttl_seconds: int = 3600):
        self._cache: dict[str, tuple[RankData, datetime]] = {}
        self._maxsize = maxsize
        self._ttl = timedelta(seconds=ttl_seconds)
    def _now(self) -> datetime:
        return datetime.utcnow()
    def _is_expired(self, timestamp: datetime) -> bool:
        return (self._now() - timestamp) > self._ttl

    def _evict_if_needed(self) -> None:
        expired = [k for k, (_, ts) in self._cache.items() if self._is_expired(ts)]
        for k in expired:
            del self._cache[k]
        if len(self._cache) >= self._maxsize:
            oldest = next(iter(self._cache))
            del self._cache[oldest]

    def get(self, domain: str) -> Optional[RankData]:
        self._evict_if_needed()
        entry = self._cache.get(domain)
        if entry is None:
            return None
        value, timestamp = entry
        if self._is_expired(timestamp):
            del self._cache[domain]
            return None
        del self._cache[domain]       
        self._cache[domain] = (value, self._now()) 
        return RankData(
            rank_value=value.rank_value,
            rank_source=value.rank_source,
            referring_domains=value.referring_domains,
            raw_response=value.raw_response,
            cached=True,
        )
    def set(self, domain: str, value: RankData) -> None:
        self._evict_if_needed()
        self._cache[domain] = (value, self._now())

    def invalidate(self, domain: str) -> None:
        self._cache.pop(domain, None)

    def clear(self) -> None:
        self._cache.clear()

    def stats(self) -> dict:
        return {
            "size": len(self._cache),
            "maxsize": self._maxsize,
            "ttl_seconds": self._ttl.total_seconds(),
            "keys": list(self._cache.keys())[:10],
        }   
_rank_cache = _RankLruCache(maxsize=256, ttl_seconds=3600)





class RankCollector:
    # API "OpenPageRank" de Keywords Everywhere (PAS domcop.com/openpagerank.com,
    # qui est un service distinct avec un autre format de cle/auth). Confirme
    # via `collect_fe_4.py` (script ayant servi a construire le dataset
    # d'entrainement) : Bearer token + POST JSON, cle au format `opr_live_...`.
    OPENPAGERANK_URL = "https://openpagerank.keywordseverywhere.com/v1/domains/bulk"
    TIMEOUT_SECONDS = 10.0

    def __init__(self,use_cache: bool = True):
        self.api_key = settings.OPEN_PAGERANK_API_KEY or ""
        self.use_cache = use_cache

    async def collect(self, domain: str) -> RankData:
        if self.use_cache:
            cached = _rank_cache.get(domain)
            if cached is not None:
                logger.info("[RankCollector] %s -> cache hit", domain)
                return cached

        try:
            result = await self._fetch_openpagerank(domain)
            logger.info(
                "[RankCollector] %s -> rank=%s referring_domains=%s",
                domain, result.rank_value, result.referring_domains,
            )
            if self.use_cache:
                _rank_cache.set(domain, result)
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

        unique_domains = list(set(domains))
        cached_results = {}
        domains_to_fetch = []

        if self.use_cache:
            for d in unique_domains:
                cached = _rank_cache.get(d)
                if cached is not None:
                    cached_results[d] = cached
                else:
                    domains_to_fetch.append(d)
        else :
            domains_to_fetch = unique_domains

        if domains_to_fetch:                

            tasks = [self.collect(d) for d in domains]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for domain, result in zip(domains_to_fetch, results):
                if isinstance(result, Exception):
                    cached_results[domain] = RankData(
                        raw_response={"error": str(result)}
                    )
                else:
                    cached_results[domain] = result

        return {
            domain: (result if not isinstance(result, Exception)
                     else RankData(raw_response={"error": str(result)}))
            for domain, result in zip(domains, results)
        }

    @staticmethod
    def cache_stats() -> dict:
        
        return _rank_cache.stats()

    @staticmethod
    def cache_clear() -> None:
        
        _rank_cache.clear()

    @staticmethod
    def cache_invalidate(domain: str) -> None:
        
        _rank_cache.invalidate(domain)