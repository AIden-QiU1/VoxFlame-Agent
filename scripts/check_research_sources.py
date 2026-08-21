#!/usr/bin/env python3
"""Validate the small research-source registry and optionally probe URLs.

Default mode is offline and deterministic. Use ``--network`` for an explicit
live check; failures are reported per source and do not silently change the
registry.
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "research" / "SOURCE_REGISTRY.yaml"
TOPICS = ("voice-agent", "agent-systems", "speech-health", "product-psychology", "product-engineering")


def topic_blocks(text: str) -> dict[str, str]:
    matches = list(re.finditer(r"^  ([a-z-]+):\s*$", text, flags=re.MULTILINE))
    blocks: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks[match.group(1)] = text[match.start():end]
    return blocks


def main() -> int:
    parser = argparse.ArgumentParser(description="Check the curated VoxFlame research source registry")
    parser.add_argument("--network", action="store_true", help="perform live HEAD/GET probes")
    args = parser.parse_args()

    if not REGISTRY.is_file():
        print(f"missing registry: {REGISTRY}", file=sys.stderr)
        return 1
    text = REGISTRY.read_text(encoding="utf-8")
    blocks = topic_blocks(text)
    urls = re.findall(r"^\s+url:\s+(https?://[^\s]+)\s*$", text, flags=re.MULTILINE)
    errors: list[str] = []
    for topic in TOPICS:
        block = blocks.get(topic, "").split("\n    discovery:", 1)[0].split("\n    radar:", 1)[0]
        anchor_count = len(re.findall(r"^\s+- id: [^\n]+\n\s+url: https?://[^\n]+\n\s+tier: (?:primary|professional)\s*$", block, flags=re.MULTILINE))
        if not 2 <= anchor_count <= 3:
            errors.append(f"{topic}: expected 2-3 default anchors, found {anchor_count}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(f"Registry syntax passed: {len(urls)} URLs, {len(TOPICS)} topics, 2-3 anchors/topic.")
    if not args.network:
        print("Network probes skipped (use --network explicitly).")
        return 0

    failures = 0
    for url in urls:
        request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "VoxFlameResearchSourceCheck/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                print(f"{response.status}\t{url}")
        except urllib.error.HTTPError as error:
            if error.code in {405, 403}:
                print(f"WARN\t{url}\tHTTP {error.code} (HEAD blocked; review with GET)")
            else:
                failures += 1
                print(f"FAIL\t{url}\tHTTP {error.code}")
        except (urllib.error.URLError, TimeoutError) as error:
            failures += 1
            print(f"FAIL\t{url}\t{error}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
