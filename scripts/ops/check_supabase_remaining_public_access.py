#!/usr/bin/env python3
"""Verify remaining Supabase tables use their approved public boundary."""

from __future__ import annotations

import json
import sys

from check_supabase_core_data_access import head_status, load_env_files


TARGETS = {
    "voice_contributions": ("transcript", False),
    "quick_phrases": ("text", False),
    "preset_phrases": ("text", True),
}


def main() -> int:
    env = load_env_files()
    url = (env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    anon_key = env.get("SUPABASE_ANON_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or ""
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_ROLE_KEY") or ""
    if not url or not anon_key or not service_key:
        print("Missing Supabase URL, anon key, or service-role key.", file=sys.stderr)
        return 2

    failures: list[str] = []
    for table, (column, anon_readable) in TARGETS.items():
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

        expected_anon_statuses = {200, 206} if anon_readable else {401, 403}
        if anon_status not in expected_anon_statuses:
            failures.append(
                f"{table}: anon status {anon_status} does not match approved boundary"
            )
        if service_status not in {200, 206}:
            failures.append(f"{table}: service role lost backend access ({service_status})")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1

    print("PASS: remaining Supabase tables match the approved public boundary.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
