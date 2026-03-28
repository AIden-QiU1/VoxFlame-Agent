#!/usr/bin/env python3
"""
从中文文章或经典朗读材料中打散出音韵强化句库。

这类句库不直接对应训练页的生活场景，而是作为内部补充池，
用于补充声韵调、节奏和朗读稳定性覆盖。
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from build_mandarin_scene_corpus import (
    build_coverage_scores,
    build_length_score,
    chinese_length,
    iter_sentence_units,
    parse_source_entry,
    read_source,
)


@dataclass(frozen=True)
class PhonologySentence:
    id: str
    text: str
    length: int
    source_id: str
    source_ref: str
    length_score: float
    coverage_score: float
    total_score: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="构建中文音韵强化句库")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--min-length", type=int, default=5)
    parser.add_argument("--max-length", type=int, default=20)
    parser.add_argument("--soft-min-length", type=int, default=5)
    parser.add_argument("--soft-max-length", type=int, default=20)
    parser.add_argument("--per-source-cap", type=int, default=120)
    return parser.parse_args()


def build_id(source_id: str, index: int) -> str:
    return f"{source_id}_{index:04d}"


def load_manifest_sources(path: Path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [parse_source_entry(entry) for entry in payload.get("sources", [])]


def main() -> int:
    args = parse_args()
    sources = load_manifest_sources(args.manifest)
    raw_rows: list[tuple[str, str, str, float]] = []

    for spec in sources:
        try:
            text, source_ref = read_source(spec)
        except Exception as exc:
            print(f"[warn] 跳过 {spec.source}: {exc}")
            continue

        seen_for_source: set[str] = set()
        count = 0
        for unit in iter_sentence_units(text):
            length = chinese_length(unit)
            if length < args.min_length or length > args.max_length:
                continue
            if unit in seen_for_source:
                continue
            seen_for_source.add(unit)
            raw_rows.append(
                (
                    unit,
                    spec.id,
                    source_ref,
                    build_length_score(
                        length,
                        args.soft_min_length,
                        args.soft_max_length,
                        args.min_length,
                        args.max_length,
                    ),
                )
            )
            count += 1
            if count >= args.per_source_cap:
                break

    deduped: dict[str, tuple[str, str, float]] = {}
    for text, source_id, source_ref, length_score in raw_rows:
        current = deduped.get(text)
        if current is None or length_score > current[2]:
            deduped[text] = (source_id, source_ref, length_score)

    ordered_texts = sorted(deduped.keys())
    coverage_scores = build_coverage_scores(ordered_texts)

    sentences: list[PhonologySentence] = []
    for index, text in enumerate(
        sorted(
            ordered_texts,
            key=lambda item: (
                -(coverage_scores.get(item, 0.0) * 2 + deduped[item][2]),
                chinese_length(item),
                item,
            ),
        ),
        start=1,
    ):
        source_id, source_ref, length_score = deduped[text]
        coverage_score = coverage_scores.get(text, 0.0)
        sentences.append(
            PhonologySentence(
                id=build_id(source_id, index),
                text=text,
                length=chinese_length(text),
                source_id=source_id,
                source_ref=source_ref,
                length_score=length_score,
                coverage_score=coverage_score,
                total_score=round(coverage_score * 2 + length_score, 6),
            )
        )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kind": "phonology_article_pool",
        "preferred_length_range": [args.soft_min_length, args.soft_max_length],
        "hard_length_range": [args.min_length, args.max_length],
        "count": len(sentences),
        "items": [asdict(item) for item in sentences],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已输出到 {args.output}")
    print(f"音韵强化句数：{len(sentences)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
