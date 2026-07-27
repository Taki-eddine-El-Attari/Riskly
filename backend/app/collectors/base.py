from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import httpx
from pydantic import BaseModel
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from app.core.config import settings
from app.core.exceptions import (
    ExternalAPIError,
    ExternalAPIRateLimitError,
    ExternalAPITimeoutError,
    ExternalServiceUnavailableError,
)
 
RETRYABLE_EXCEPTIONS = (ExternalAPITimeoutError, ExternalServiceUnavailableError)

 
def map_http_error(source_name: str, response: httpx.Response) -> None:
    status = response.status_code
 
    if status == 429:
        raise ExternalAPIRateLimitError(source_name=source_name)
    if status in (502, 503):
        raise ExternalServiceUnavailableError(source_name=source_name)
    if status >= 400:
        raise ExternalAPIError(
            source_name=source_name,
            message=f"HTTP {status} — {response.text[:200]}",
        )
 
 
class BaseCollector(ABC):
 
    source_name: str = "unknown_source"
 
    def __init__(self, timeout: Optional[float] = None):
        self.timeout = timeout or settings.EXTERNAL_API_TIMEOUT_SECONDS
 
    @abstractmethod
    def fetch(self, domain_name: str) -> BaseModel:
        raise NotImplementedError
 
    @retry(
        retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    def _request(
        self,
        method: str,
        url: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, Any]] = None,
    ) -> httpx.Response:
        try:
            response = httpx.request(
                method,
                url,
                params=params,
                headers=headers,
                timeout=self.timeout,
            )
        except httpx.TimeoutException as exc:
            raise ExternalAPITimeoutError(source_name=self.source_name) from exc
        except httpx.ConnectError as exc:
            raise ExternalServiceUnavailableError(source_name=self.source_name) from exc
 
        map_http_error(self.source_name, response)
        return response
 