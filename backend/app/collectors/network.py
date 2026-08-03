from __future__ import annotations

import asyncio
import socket
from dataclasses import dataclass
from typing import Optional

import dns.exception
import dns.resolver
import httpx

from app.core.config import settings

IP_API_URL = "http://ip-api.com/json/{ip}"


@dataclass
class GeoResult:
    country: Optional[str] = None
    ip: Optional[str] = None


@dataclass
class NameserverResult:
    count: Optional[int] = None


class GeoCollector:
    source_name = "ip_api"

    async def collect(self, domain_name: str) -> GeoResult:
        loop = asyncio.get_running_loop()
        try:
            ip = await loop.run_in_executor(None, socket.gethostbyname, domain_name)
        except (socket.gaierror, socket.timeout):
            return GeoResult()

        try:
            async with httpx.AsyncClient(timeout=settings.EXTERNAL_API_TIMEOUT_SECONDS) as client:
                response = await client.get(IP_API_URL.format(ip=ip))
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError):
            return GeoResult(ip=ip)

        if data.get("status") != "success":
            return GeoResult(ip=ip)

        return GeoResult(country=data.get("country"), ip=ip)


class NameserverCollector:
    source_name = "dns_ns"

    async def collect(self, domain_name: str) -> NameserverResult:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._resolve_sync, domain_name)

    def _resolve_sync(self, domain_name: str) -> NameserverResult:
        resolver = dns.resolver.Resolver()
        resolver.timeout = settings.EXTERNAL_API_TIMEOUT_SECONDS
        resolver.lifetime = settings.EXTERNAL_API_TIMEOUT_SECONDS
        try:
            answers = resolver.resolve(domain_name, "NS")
            return NameserverResult(count=len(answers))
        except dns.resolver.NXDOMAIN:
            return NameserverResult(count=None)
        except dns.resolver.NoAnswer:
            return NameserverResult(count=0)
        except dns.exception.Timeout:
            return NameserverResult(count=None)
