#!/usr/bin/env python3
"""Stream a Tatoeba detailed TSV through the repository's Simplified Chinese normalizer."""

from __future__ import annotations

import argparse
import unicodedata
from pathlib import Path

from export_frontend_source_corpus import to_simplified_chinese


def normalize_tsv(input_path: Path, output_path: Path) -> tuple[int, int]:
    rows = 0
    changed = 0
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with input_path.open("r", encoding="utf-8") as source, output_path.open(
        "w", encoding="utf-8", newline=""
    ) as destination:
        for line in source:
            row = line.rstrip("\n").split("\t")
            if len(row) < 4:
                continue
            normalized = unicodedata.normalize("NFKC", to_simplified_chinese(row[2])).strip()
            if normalized != row[2]:
                changed += 1
            row[2] = normalized
            destination.write("\t".join(row) + "\n")
            rows += 1
    return rows, changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    rows, changed = normalize_tsv(args.input, args.output)
    print(f"normalized {rows} Tatoeba rows; {changed} rows changed")


if __name__ == "__main__":
    main()
