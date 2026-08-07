#!/usr/bin/env python3
"""Verify that public Supabase roles cannot read VoxFlame core user data."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TARGETS = {
    "user_profiles": "preferences",
    "sessions": "transcript",
    "memories": "content",
}


def load_env_files() -> dict[str, str]:
    values: dict[str, str] = {}
    for path in (ROOT / ".env", ROOT / "backend/.env", ROOT / "frontend/.env.local"):
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, raw_value = line.split("=", 1)
            value = raw_value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            values[name.strip()] = value
    return values


def head_status(url: str, key: str, table: str, column: str) -> tuple[int, str | None]:
    request = urllib.request.Request(
        f"{url}/rest/v1/{table}?select={column}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
            "Range": "0-0",
        },
        method="HEAD",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, response.headers.get("Content-Range")
    except urllib.error.HTTPError as error:
        # Never print the response body: it may contain database details.
        return error.code, error.headers.get("Content-Range")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--expect-open",
        action="store_true",
        help="Pre-migration diagnostic: require the anon role to remain readable.",
    )
    args = parser.parse_args()

    env = load_env_files()
    url = (env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    anon_key = env.get("SUPABASE_ANON_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or ""
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_ROLE_KEY") or ""
    if not url or not anon_key or not service_key:
        print("Missing Supabase URL, anon key, or service-role key.", file=sys.stderr)
        return 2

    failures: list[str] = []
    for table, column in TARGETS.items():
        anon_status, anon_range = head_status(url, anon_key, table, column)
        service_status, service_range = head_status(url, service_key, table, column)
        print(
            json.dumps(
                {
                    "table": table,
                    "anon_http": anon_status,
                    "anon_content_range": anon_range,
                    "service_role_http": service_status,
                    "service_role_content_range": service_range,
                },
                ensure_ascii=False,
            )
        )

        if args.expect_open:
            if anon_status not in {200, 206}:
                failures.append(f"{table}: anon unexpectedly blocked ({anon_status})")
        elif anon_status not in {401, 403}:
            failures.append(f"{table}: anon still has access ({anon_status})")

        if service_status not in {200, 206}:
            failures.append(f"{table}: service role lost backend access ({service_status})")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1

    print("PASS: core Supabase data access matches the expected boundary.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
