import asyncio
import csv
import socket
import sys
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
import dns.resolver
import pydnsbl
import tldextract
from tranco import Tranco

# ---------- Cles API (remplacez par vos vraies cles) ----------
OPENPAGERANK_API_KEY = "votre_cle_openpagerank_ici"
PHISHTANK_API_KEY = "votre_cle_phishtank_ici"


# ---------- RDAP (age du domaine) ----------
async def get_domain_age(domain: str, client: httpx.AsyncClient, timeout: float = 5.0) -> dict:
    try:
        response = await client.get(f"https://rdap.org/domain/{domain}", timeout=timeout)
        response.raise_for_status()
        data = response.json()

        date_creation = None
        for event in data.get("events", []):
            if event.get("eventAction") == "registration":
                date_creation = event.get("eventDate")
                break

        if date_creation is None:
            return {"age_domaine": None, "error": "no_registration_event"}

        created = datetime.fromisoformat(date_creation.replace("Z", "+00:00"))
        age_jours = (datetime.now(timezone.utc) - created).days
        return {"age_domaine": age_jours, "error": None}

    except httpx.TimeoutException:
        return {"age_domaine": None, "error": "timeout"}
    except httpx.HTTPStatusError as e:
        return {"age_domaine": None, "error": f"http_{e.response.status_code}"}
    except Exception as e:
        return {"age_domaine": None, "error": str(e)}


# ---------- Open PageRank (rank + backlinks) - CLE API REQUISE ----------
async def get_page_rank(domain: str, client: httpx.AsyncClient, timeout: float = 5.0) -> dict:
    api_key = OPENPAGERANK_API_KEY
    if not api_key or api_key == "votre_cle_openpagerank_ici":
        return {"open_page_rank": None, "referring_domains": None, "error": "missing_api_key"}

    try:
        response = await client.get(
            "https://openpagerank.com/api/v1.0/getPageRank",
            headers={"API-OPR": api_key},
            params={"domains[]": domain},
            timeout=timeout,
        )
        response.raise_for_status()
        result = response.json().get("response", [{}])[0]

        if result.get("status_code") != 200:
            return {"open_page_rank": 0.0, "referring_domains": 0, "error": "domain_not_found"}

        return {
            "open_page_rank": float(result.get("page_rank_decimal", 0.0)),
            "referring_domains": result.get("referring_domains"),  # non natif au plan gratuit
            "error": None,
        }

    except httpx.TimeoutException:
        return {"open_page_rank": None, "referring_domains": None, "error": "timeout"}
    except Exception as e:
        return {"open_page_rank": None, "referring_domains": None, "error": str(e)}


# ---------- ip-api (pays de l'hebergeur) ----------
async def get_country(domain: str, client: httpx.AsyncClient, timeout: float = 5.0) -> dict:
    try:
        ip = socket.gethostbyname(domain)
    except socket.gaierror:
        return {"country": None, "ip": None, "error": "dns_resolution_failed"}

    try:
        response = await client.get(f"http://ip-api.com/json/{ip}", timeout=timeout)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != "success":
            return {"country": None, "ip": ip, "error": "lookup_failed"}

        return {"country": data.get("countryCode"), "ip": ip, "error": None}

    except httpx.TimeoutException:
        return {"country": None, "ip": ip, "error": "timeout"}
    except Exception as e:
        return {"country": None, "ip": ip, "error": str(e)}


# ---------- dnspython (nombre de serveurs) - synchrone -> thread pool ----------
def _get_nameserver_count_sync(domain: str) -> dict:
    try:
        answers = dns.resolver.resolve(domain, "NS", lifetime=5.0)
        return {"nbr_serv": len(answers), "error": None}
    except dns.resolver.NXDOMAIN:
        return {"nbr_serv": None, "error": "nxdomain"}
    except dns.resolver.NoAnswer:
        return {"nbr_serv": 0, "error": None}
    except Exception as e:
        return {"nbr_serv": None, "error": str(e)}


async def get_nameserver_count(domain: str) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _get_nameserver_count_sync, domain)


# ---------- pydnsbl (blacklist DNS) - synchrone -> thread pool ----------
def _get_blacklist_status_sync(domain: str) -> dict:
    try:
        checker = pydnsbl.DNSBLDomainChecker()
        result = checker.check(domain)
        return {"is_blacklisted": int(result.blacklisted), "error": None}
    except Exception as e:
        return {"is_blacklisted": None, "error": str(e)}


async def get_blacklist_status(domain: str) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _get_blacklist_status_sync, domain)


# ---------- PhishTank (base de menaces verifiees) - CLE API REQUISE ----------
async def check_phishtank(domain: str, client: httpx.AsyncClient, timeout: float = 5.0) -> dict:
    api_key = PHISHTANK_API_KEY
    if not api_key or api_key == "votre_cle_phishtank_ici":
        return {"in_phishtank": None, "error": "missing_api_key"}

    try:
        response = await client.post(
            "https://checkurl.phishtank.com/checkurl/",
            data={
                "url": domain,
                "format": "json",
                "app_key": api_key,
            },
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
        in_db = data.get("results", {}).get("in_database", False)
        verified = data.get("results", {}).get("verified", False)
        return {"in_phishtank": bool(in_db and verified), "error": None}

    except httpx.TimeoutException:
        return {"in_phishtank": None, "error": "timeout"}
    except Exception as e:
        return {"in_phishtank": None, "error": str(e)}


# ---------- URLhaus (feed telecharge, verification locale) ----------
_urlhaus_cache: set[str] | None = None


async def _load_urlhaus_feed(client: httpx.AsyncClient, timeout: float = 15.0) -> set[str]:
    global _urlhaus_cache
    if _urlhaus_cache is not None:
        return _urlhaus_cache
    try:
        response = await client.get(
            "https://urlhaus.abuse.ch/downloads/text_online/", timeout=timeout
        )
        response.raise_for_status()
        lines = response.text.splitlines()
        domains = set()
        for line in lines:
            if line.startswith("#") or not line.strip():
                continue
            try:
                host = httpx.URL(line.strip()).host
                if host:
                    domains.add(host.lower())
            except Exception:
                continue
        _urlhaus_cache = domains
        return domains
    except Exception:
        _urlhaus_cache = set()
        return _urlhaus_cache


async def check_urlhaus(domain: str, client: httpx.AsyncClient) -> dict:
    feed = await _load_urlhaus_feed(client)
    if not feed:
        return {"in_urlhaus": None, "error": "feed_unavailable"}
    return {"in_urlhaus": domain.lower() in feed, "error": None}


# ---------- OpenPhish (feed telecharge, verification locale) ----------
_openphish_cache: set[str] | None = None


async def _load_openphish_feed(client: httpx.AsyncClient, timeout: float = 15.0) -> set[str]:
    global _openphish_cache
    if _openphish_cache is not None:
        return _openphish_cache
    try:
        response = await client.get("https://openphish.com/feed.txt", timeout=timeout)
        response.raise_for_status()
        domains = set()
        for line in response.text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                host = httpx.URL(line).host
                if host:
                    domains.add(host.lower())
            except Exception:
                continue
        _openphish_cache = domains
        return domains
    except Exception:
        _openphish_cache = set()
        return _openphish_cache


async def check_openphish(domain: str, client: httpx.AsyncClient) -> dict:
    feed = await _load_openphish_feed(client)
    if not feed:
        return {"in_openphish": None, "error": "feed_unavailable"}
    return {"in_openphish": domain.lower() in feed, "error": None}


# ---------- Tranco (verification locale, liste des domaines de reference "sains") ----------
def check_tranco(domain: str) -> dict:
    try:
        t = Tranco(cache=True, cache_dir=".tranco_cache")
        latest_list = t.list()
        rank = latest_list.rank(domain)
        # rank retourne un grand nombre si absent, selon la version de la lib
        in_top_1m = rank is not None and rank <= 1_000_000
        return {"tranco_rank": rank, "in_tranco_top_1m": in_top_1m, "error": None}
    except Exception as e:
        return {"tranco_rank": None, "in_tranco_top_1m": None, "error": str(e)}


# ---------- HumbleWorth (estimation indicative, hors scoring) ----------
async def get_humbleworth_estimate(domain: str, client: httpx.AsyncClient, timeout: float = 5.0) -> dict:
    """
    HumbleWorth ne propose pas d'API publique documentee officiellement.
    Fonction laissee en placeholder : a completer si un endpoint est
    confirme disponible, sinon a retirer et garder l'affichage manuel.
    """
    return {"humbleworth_estimate": None, "error": "no_public_api_documented"}


# ---------- Features lexicales (locales, aucun appel reseau) ----------
def get_lexical_features(domain: str) -> dict:
    extracted = tldextract.extract(domain)
    return {
        "domain_len": len(domain),
        "nbr_hyp": domain.count("-"),
        "tld": extracted.suffix or None,
    }


# ---------- Orchestrateur global ----------
async def collect_domain_features(domain: str) -> dict:
    lexical = get_lexical_features(domain)
    tranco_res = check_tranco(domain)

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            get_domain_age(domain, client),
            get_page_rank(domain, client),
            get_country(domain, client),
            get_nameserver_count(domain),
            get_blacklist_status(domain),
            check_phishtank(domain, client),
            check_urlhaus(domain, client),
            check_openphish(domain, client),
            get_humbleworth_estimate(domain, client),
            return_exceptions=True,
        )

    labels = [
        "rdap", "open_page_rank", "ip_api", "dns", "pydnsbl",
        "phishtank", "urlhaus", "openphish", "humbleworth",
    ]
    features, errors = {}, {}

    for label, res in zip(labels, results):
        if isinstance(res, Exception):
            errors[label] = str(res)
            continue
        if res.get("error"):
            errors[label] = res["error"]
        features.update({k: v for k, v in res.items() if k != "error"})

    if tranco_res.get("error"):
        errors["tranco"] = tranco_res["error"]
    features.update({k: v for k, v in tranco_res.items() if k != "error"})

    features.update(lexical)

    # Signal d'alerte consolide "presence dans une base de menaces"
    in_threat_db = any([
        features.get("in_phishtank") is True,
        features.get("in_urlhaus") is True,
        features.get("in_openphish") is True,
    ])
    features["in_threat_database"] = in_threat_db

    return {"domain": domain, "features": features, "errors": errors}


# ---------- Generation du dataset CSV ----------
def load_domain_list(path: str) -> list[str]:
    """Charge une liste de domaines depuis un fichier texte (un par ligne)."""
    p = Path(path)
    if not p.exists():
        print(f"Fichier introuvable : {path}")
        return []
    with open(p, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


async def build_dataset(
    domaines_sains: list[str],
    domaines_malveillants: list[str],
    output_path: str = "dataset.csv",
    concurrency: int = 5,
) -> None:
    """
    Collecte les features pour tous les domaines et ecrit le CSV final.
    concurrency limite le nombre de domaines traites en parallele, pour
    respecter les quotas des APIs (notamment ip-api : 45 req/min).
    """
    all_domains = [(d, 0) for d in domaines_sains] + [(d, 1) for d in domaines_malveillants]
    print(f"Total a traiter : {len(all_domains)} domaines "
          f"({len(domaines_sains)} sains, {len(domaines_malveillants)} malveillants)")

    semaphore = asyncio.Semaphore(concurrency)
    rows = []

    async def process_one(domain: str, label: int, index: int, total: int) -> None:
        async with semaphore:
            print(f"[{index}/{total}] {domain} (label={label})")
            result = await collect_domain_features(domain)
            row = {"domain": domain, "label": label}
            row.update(result["features"])
            if result["errors"]:
                row["_errors"] = ";".join(result["errors"].keys())
            rows.append(row)

    tasks = [
        process_one(domain, label, i + 1, len(all_domains))
        for i, (domain, label) in enumerate(all_domains)
    ]
    await asyncio.gather(*tasks)

    fieldnames = ["domain", "label"]
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nDataset ecrit dans : {output_path} ({len(rows)} lignes)")


if __name__ == "__main__":
    sains = load_domain_list("domaines_sains.txt")
    malveillants = load_domain_list("domaines_malveillants.txt")

    if not sains and not malveillants:
        print("Aucun domaine a traiter. Verifiez vos fichiers domaines_sains.txt "
              "et domaines_malveillants.txt (un domaine par ligne).")
        sys.exit(1)

    asyncio.run(build_dataset(sains, malveillants, output_path="dataset.csv", concurrency=5))