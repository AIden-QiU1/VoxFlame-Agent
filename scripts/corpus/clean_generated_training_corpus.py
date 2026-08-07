#!/usr/bin/env python3
"""Remove only confirmed severe sentence-level pollution from a generated corpus."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from export_frontend_source_corpus import SEVERE_REJECTION_REASONS, rejection_reason


def merge_audits(previous: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    removed_by_text: dict[str, dict[str, str]] = {}
    for item in previous.get("removed_items", []) + current.get("removed_items", []):
        removed_by_text[str(item.get("text", ""))] = item

    removed_items = list(removed_by_text.values())
    reason_counts = Counter(item["reason"] for item in removed_items)
    category_counts = Counter(item["category"] for item in removed_items)
    return {
        **current,
        "removed_count": len(removed_items),
        "reason_counts": dict(sorted(reason_counts.items())),
        "category_counts": dict(sorted(category_counts.items())),
        "removed_items": removed_items,
    }


def clean_payload(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    removed: list[dict[str, str]] = []
    reason_counts: Counter[str] = Counter()
    category_counts: Counter[str] = Counter()

    for category, category_payload in payload.get("categories", {}).items():
        kept_items: list[dict[str, Any]] = []
        for item in category_payload.get("items", []):
            text = str(item.get("text", ""))
            reason = rejection_reason(text)
            if reason not in SEVERE_REJECTION_REASONS:
                kept_items.append(item)
                continue

            removed.append(
                {
                    "id": str(item.get("id", "")),
                    "category": str(category),
                    "text": text,
                    "reason": reason,
                }
            )
            reason_counts[reason] += 1
            category_counts[str(category)] += 1

        category_payload["items"] = kept_items
        category_payload["count"] = len(kept_items)

    generated_from = payload.setdefault("generated_from", {})
    generated_from["source_item_counts_stage"] = "before_targeted_severe_cleanup"
    generated_from["targeted_severe_cleanup"] = {
        "removed_count": len(removed),
        "sentence_level_only": True,
        "source_level_exclusion": False,
        "audit": "frontend/src/lib/corpus/generated/mandarin-training-real.cleanup-audit.json",
    }
    payload["generated_at"] = datetime.now(timezone.utc).isoformat()

    policy = payload.setdefault("policy", {})
    policy["severe_cleanup_scope"] = [
        "explicit sexual fragments, excluding valid medical expressions",
        "direct violent or graphic fragments",
        "direct advertising, exam-site and subscription calls to action",
        "clear ASR corruption, invalid repetition and filler-contaminated fragments",
    ]
    policy["explicitly_retained_topics"] = [
        "ordinary news",
        "finance and real estate",
        "film, television and dialogue",
        "valid medical and help-seeking expressions",
    ]

    audit = {
        "kind": "targeted_severe_training_corpus_cleanup",
        "removed_count": len(removed),
        "reason_counts": dict(sorted(reason_counts.items())),
        "category_counts": dict(sorted(category_counts.items())),
        "policy": {
            "sentence_level_only": True,
            "source_level_exclusion": False,
            "fixed_removal_target": False,
            "normal_news_finance_entertainment_and_medical_content_retained": True,
        },
        "removed_items": removed,
    }
    return payload, audit


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="逐句清理生成语料中的严重污染")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--audit-output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    cleaned, audit = clean_payload(payload)
    if args.audit_output.exists():
        previous_audit = json.loads(args.audit_output.read_text(encoding="utf-8"))
        audit = merge_audits(previous_audit, audit)
    cleaned["generated_from"]["targeted_severe_cleanup"]["removed_count"] = audit["removed_count"]
    args.output.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.audit_output.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"removed: {audit['removed_count']}")
    print(f"reasons: {audit['reason_counts']}")
    print(f"categories: {audit['category_counts']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
