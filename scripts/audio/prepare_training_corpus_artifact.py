#!/usr/bin/env python3
"""
Prepare account-level training corpus artifacts from the OSS account download.

The script reads artifacts/oss-by-account/_objects.jsonl, copies only current
remote objects for selected account labels, skips manifest.jsonl, and creates a
trimmed WAV copy where long silent runs are shortened.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import wave
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class TrimStats:
    source: str
    output: str
    original_ms: int
    trimmed_ms: int
    removed_ms: int
    long_silence_runs: int
    copied_without_trim: bool = False
    error: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare trimmed training corpus artifacts")
    parser.add_argument("--objects-jsonl", type=Path, default=Path("artifacts/oss-by-account/_objects.jsonl"))
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--account-label", action="append", required=True)
    parser.add_argument("--min-silence-ms", type=int, default=500)
    parser.add_argument("--keep-silence-ms", type=int, default=120)
    return parser.parse_args()


def read_records(path: Path, labels: set[str]) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("accountLabel") in labels:
                records.append(record)
    return records


def safe_relative_under_account(record: dict[str, object]) -> Path:
    account_label = str(record["accountLabel"])
    local_path = Path(str(record["localPath"]))
    parts = local_path.parts
    try:
        index = parts.index(account_label)
    except ValueError:
        return Path(account_label) / local_path.name
    return Path(*parts[index:])


def wav_rms(frame: bytes, sample_width: int) -> float:
    if not frame:
        return 0.0
    if sample_width == 2:
        total = 0
        count = len(frame) // 2
        for index in range(0, len(frame) - 1, 2):
            value = int.from_bytes(frame[index:index + 2], "little", signed=True)
            total += value * value
        return math.sqrt(total / max(1, count))
    if sample_width == 1:
        total = 0
        count = len(frame)
        for byte in frame:
            value = byte - 128
            total += value * value
        return math.sqrt(total / max(1, count))
    return 1.0


def trim_wav(source: Path, output: Path, min_silence_ms: int, keep_silence_ms: int) -> TrimStats:
    try:
        with wave.open(str(source), "rb") as reader:
            params = reader.getparams()
            channels = reader.getnchannels()
            sample_width = reader.getsampwidth()
            frame_rate = reader.getframerate()
            frame_count = reader.getnframes()
            frames = reader.readframes(frame_count)
    except Exception as exc:
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, output)
        return TrimStats(
            source=str(source),
            output=str(output),
            original_ms=0,
            trimmed_ms=0,
            removed_ms=0,
            long_silence_runs=0,
            copied_without_trim=True,
            error=str(exc),
        )

    frame_size = channels * sample_width
    chunk_frames = max(1, int(frame_rate * 0.02))
    chunk_bytes = chunk_frames * frame_size
    chunks = [frames[index:index + chunk_bytes] for index in range(0, len(frames), chunk_bytes)]
    rms_values = [wav_rms(chunk, sample_width) for chunk in chunks]
    peak_rms = max(rms_values) if rms_values else 0.0
    threshold = max(120.0, peak_rms * 0.015)
    min_silence_chunks = max(1, int(min_silence_ms / 20))
    keep_chunks = max(0, int(keep_silence_ms / 20))

    output_chunks: list[bytes] = []
    index = 0
    long_runs = 0
    while index < len(chunks):
        if rms_values[index] > threshold:
            output_chunks.append(chunks[index])
            index += 1
            continue

        start = index
        while index < len(chunks) and rms_values[index] <= threshold:
            index += 1
        run_length = index - start
        if run_length >= min_silence_chunks:
            long_runs += 1
            if keep_chunks > 0:
                head = keep_chunks // 2
                tail = keep_chunks - head
                output_chunks.extend(chunks[start:start + head])
                output_chunks.extend(chunks[max(start + head, index - tail):index])
        else:
            output_chunks.extend(chunks[start:index])

    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), "wb") as writer:
        writer.setparams(params)
        writer.writeframes(b"".join(output_chunks))

    original_ms = int(frame_count / frame_rate * 1000) if frame_rate else 0
    trimmed_frames = sum(len(chunk) for chunk in output_chunks) // max(1, frame_size)
    trimmed_ms = int(trimmed_frames / frame_rate * 1000) if frame_rate else 0
    return TrimStats(
        source=str(source),
        output=str(output),
        original_ms=original_ms,
        trimmed_ms=trimmed_ms,
        removed_ms=max(0, original_ms - trimmed_ms),
        long_silence_runs=long_runs,
    )


def main() -> int:
    args = parse_args()
    labels = set(args.account_label)
    records = read_records(args.objects_jsonl, labels)
    raw_root = args.output_dir / "raw"
    trimmed_root = args.output_dir / "trimmed"

    summary: dict[str, object] = {
        "source_objects_jsonl": str(args.objects_jsonl),
        "account_labels": sorted(labels),
        "manifest_jsonl_skipped": True,
        "min_silence_ms": args.min_silence_ms,
        "keep_silence_ms": args.keep_silence_ms,
        "accounts": {},
    }

    trim_stats: list[TrimStats] = []
    for record in records:
        source = Path(str(record["localPath"]))
        relative = safe_relative_under_account(record)
        account_label = str(record["accountLabel"])
        account_summary = summary["accounts"].setdefault(
            account_label,
            {
                "objects_seen": 0,
                "files_copied_raw": 0,
                "audio_files": 0,
                "transcript_files": 0,
                "manifest_files_skipped": 0,
                "original_audio_ms": 0,
                "trimmed_audio_ms": 0,
                "removed_silence_ms": 0,
                "long_silence_runs": 0,
            },
        )
        assert isinstance(account_summary, dict)
        account_summary["objects_seen"] += 1

        if source.name == "manifest.jsonl":
            account_summary["manifest_files_skipped"] += 1
            continue

        raw_target = raw_root / relative
        raw_target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, raw_target)
        account_summary["files_copied_raw"] += 1

        if source.suffix.lower() == ".txt":
            account_summary["transcript_files"] += 1
            continue

        if source.suffix.lower() != ".wav":
            continue

        account_summary["audio_files"] += 1
        stat = trim_wav(source, trimmed_root / relative, args.min_silence_ms, args.keep_silence_ms)
        trim_stats.append(stat)
        account_summary["original_audio_ms"] += stat.original_ms
        account_summary["trimmed_audio_ms"] += stat.trimmed_ms
        account_summary["removed_silence_ms"] += stat.removed_ms
        account_summary["long_silence_runs"] += stat.long_silence_runs

    summary["totals"] = {
        "records_seen": len(records),
        "raw_files": sum(int(account["files_copied_raw"]) for account in summary["accounts"].values()),
        "audio_files": sum(int(account["audio_files"]) for account in summary["accounts"].values()),
        "removed_silence_ms": sum(stat.removed_ms for stat in trim_stats),
        "long_silence_runs": sum(stat.long_silence_runs for stat in trim_stats),
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "trim_report.json").write_text(
        json.dumps([asdict(stat) for stat in trim_stats], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
