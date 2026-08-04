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
class BacklinkProfile:
    
    referring_domains_count: Optional[int] = None
    toxic_backlink_ratio: Optional[float] = None
    backlink_count: Optional[int] = None
    quality_estimate: Optional[float] = None
    source: Optional[str] = None
    raw_response: Optional[dict] = None
    cached : bool = False

class _BacklinkLruCache:
    def __init__(self, maxsize: int = 256, ttl_seconds: int = 3600):
        self._cache: dict[str, tuple[BacklinkProfile, datetime]] = {}
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

    def get(self, domain: str) -> Optional[BacklinkProfile]:
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
        return BacklinkProfile(
            referring_domains_count=value.referring_domains_count,
            toxic_backlink_ratio=value.toxic_backlink_ratio,
            backlink_count=value.backlink_count,
            quality_estimate=value.quality_estimate,
            source=value.source,
            raw_response=value.raw_response,
            cached=True,
        )
    def set(self, domain: str, value: BacklinkProfile) -> None:
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

_backlinks_cache = _BacklinkLruCache(maxsize=256, ttl_seconds=3600)

class BacklinksCollector:
    # Meme service que RankCollector (cf. son commentaire) : API "OpenPageRank"
    # de Keywords Everywhere, Bearer token + POST JSON.
    OPENPAGERANK_URL = "https://openpagerank.keywordseverywhere.com/v1/domains/bulk"
    TIMEOUT_SECONDS = 10.0

    def __init__(self,use_cache: bool = True):
        self.api_key = settings.OPEN_PAGERANK_API_KEY or ""
        self.use_cache = use_cache

    async def collect(self, domain: str) -> BacklinkProfile:
        if self.use_cache:
            cached = _backlinks_cache.get(domain)
            if cached is not None:
                 logger.info(
                    "[BacklinksCollector] %s -> CACHE HIT backlink_count=%s",
                    domain, cached.backlink_count,
                )
                 return cached

        try:
            result = await self._fetch_openpagerank(domain)
            logger.info(
                "[BacklinksCollector] %s -> backlink_count=%s quality=%s",
                domain, result.backlink_count, result.quality_estimate,
            )
            if self.use_cache:
                _backlinks_cache.set(domain, result)
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

    async def collect_batch(self, domains: list[str]) -> dict[str, BacklinkProfile]:
        unique_domains = list(set(domains))
        cached_results = {}
        domains_to_fetch = []

        if self._use_cache:
            for d in unique_domains:
                cached = _backlinks_cache.get(d)
                if cached is not None:
                    cached_results[d] = cached
                else:
                    domains_to_fetch.append(d)
        else:
            domains_to_fetch = unique_domains

        if domains_to_fetch:
            tasks = [self.collect(d) for d in domains_to_fetch]
            fetched_results = await asyncio.gather(*tasks, return_exceptions=True)

            for domain, result in zip(domains_to_fetch, fetched_results):
                if isinstance(result, Exception):
                    cached_results[domain] = BacklinkProfile(
                        raw_response={"error": str(result)}
                    )
                else:
                    cached_results[domain] = result

        return {d: cached_results[d] for d in domains}         

    @staticmethod
    def cache_stats() -> dict:
        
        return _backlinks_cache.stats()

    @staticmethod
    def cache_clear() -> None:
       
        _backlinks_cache.clear()

    @staticmethod
    def cache_invalidate(domain: str) -> None:
        
        _backlinks_cache.invalidate(domain)   