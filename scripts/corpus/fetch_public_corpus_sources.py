#!/usr/bin/env python3
"""
抓取公开网页语料来源，保存为本地快照，便于后续离线清洗和复跑。

用途：
- 先把 URL 来源落到本地目录，避免每次构建都实时访问网页
- 保留抓取时间、内容类型、状态码等基础元数据
- 后续可直接把输出目录里的文件再喂给 build_mandarin_scene_corpus.py
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class SourceSpec:
    id: str
    source: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="抓取公开中文语料网页到本地目录")
    parser.add_argument("--manifest", type=Path, required=True, help="来源清单 JSON")
    parser.add_argument("--output-dir", type=Path, required=True, help="输出目录")
    return parser.parse_args()


def load_sources(path: Path) -> list[SourceSpec]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    sources: list[SourceSpec] = []
    for entry in payload.get("sources", []):
        if not isinstance(entry, dict):
            continue
        source = str(entry.get("source", ""))
        source_id = str(entry.get("id", ""))
        if not source.startswith(("http://", "https://")) or not source_id:
            continue
        sources.append(SourceSpec(id=source_id, source=source))
    return sources


def extension_for_content_type(content_type: str) -> str:
    lowered = content_type.lower()
    if "html" in lowered:
        return ".html"
    if "json" in lowered:
        return ".json"
    if "xml" in lowered:
        return ".xml"
    return ".txt"


def fetch_one(spec: SourceSpec, output_dir: Path) -> dict[str, Any]:
    request = urllib.request.Request(
        spec.source,
        headers={"User-Agent": "Mozilla/5.0 VoxFlameCorpusFetcher/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read()
        content_type = response.headers.get("Content-Type", "text/plain")
        status = getattr(response, "status", 200)

    suffix = extension_for_content_type(content_type)
    output_path = output_dir / f"{spec.id}{suffix}"
    output_path.write_bytes(data)
    return {
        "id": spec.id,
        "source": spec.source,
        "status": status,
        "content_type": content_type,
        "output_path": str(output_path),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    args = parse_args()
    sources = load_sources(args.manifest)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest": str(args.manifest),
        "results": [],
    }

    for spec in sources:
        try:
            result = fetch_one(spec, args.output_dir)
        except Exception as exc:
            result = {
                "id": spec.id,
                "source": spec.source,
                "error": str(exc),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        report["results"].append(result)

    report_path = args.output_dir / "_fetch_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    local_manifest = {
        "sources": [
            {
                "id": result["id"],
                "source": result["output_path"],
            }
            for result in report["results"]
            if result.get("output_path")
        ]
    }
    (args.output_dir / "_local_manifest.json").write_text(
        json.dumps(local_manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
