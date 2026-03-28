#!/usr/bin/env python3
"""
构建 VoxFlame 中文训练句库。

能力：
- 支持 URL、本地 txt/csv/tsv/json/jsonl/html 输入
- 支持 manifest 化来源清单（优先级、场景提示、用途权重）
- 先打散文章，再做句子清洗和去重
- 按句长、场景匹配、常用程度、音系覆盖度综合打分
- 同时输出总库和按场景拆分的文件

注意：
- 最终产物默认不写拼音。
- 如果环境里安装了 pypinyin，会额外使用它做音系覆盖打分；没装也能跑。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Sequence

CHINESE_RE = re.compile(r"[\u4e00-\u9fff]")
SENTENCE_SPLIT_RE = re.compile(r"[。！？!?；;\n\r]+")
CLAUSE_SPLIT_RE = re.compile(r"[，,、：:/／]")
NOISE_RE = re.compile(r"[“”\"'‘’《》〈〉【】\[\]()（）·…—\-]")
SPACE_RE = re.compile(r"\s+")
MULTI_COMMA_RE = re.compile(r"[，,、：:/／]+")
ASCII_TOKEN_RE = re.compile(r"\b[A-Za-z][A-Za-z0-9.+\-/]*\b")
USER_AGENT = "Mozilla/5.0 VoxFlameCorpusBuilder/1.0"
UI_NOISE_PATTERNS = (
    "app image",
    "image",
    "button",
    "menu",
    "导航",
    "当前位置",
    "上一篇",
    "下一篇",
    "相关阅读",
    "相关链接",
    "返回顶部",
    "点击展开",
    "点击收起",
    "字体大小",
    "打印",
    "收藏",
    "扫一扫",
    "关闭窗口",
    "版权",
    "隐私",
    "cookie",
    "网站首页",
    "维基文库",
    "维基百科",
    "维基共享",
    "关于维基",
    "自由的图书馆",
    "条款下提供",
    "本作品",
    "原文",
    "阅论编",
    "家人共享",
    "共享成员",
    "告诉我们",
    "更多>>",
    "更多>",
)

SCENE_RULES = {
    "开口先说": [
        "请慢一点",
        "请再说",
        "再说一次",
        "听我说",
        "我想说",
        "我想表达",
        "别替我",
        "告诉我",
        "我来说",
        "没听清",
        "没听懂",
        "我不懂",
        "给我时间",
        "看着我",
        "请直接",
        "请帮我",
        "我需要帮助",
        "和朋友说话",
    ],
    "看病拿药": [
        "医生",
        "护士",
        "挂号",
        "复诊",
        "看病",
        "吃药",
        "取药",
        "用药",
        "药品",
        "药店",
        "门诊",
        "急诊",
        "住院",
        "内科",
        "医保",
        "疼痛",
        "头晕",
        "难受",
        "发烧",
        "心电图",
    ],
    "家里需要": [
        "喝水",
        "我饿了",
        "休息",
        "我想回家",
        "家人",
        "上厕所",
        "睡觉",
        "吃饭",
        "联系家里",
        "扶我",
        "帮我拿",
        "请帮我",
        "我想要",
        "洗澡",
        "穿衣",
        "回家",
    ],
    "紧急情况": [
        "救命",
        "120",
        "幺二零",
        "马上",
        "急救",
        "喘不过气",
        "胸口",
        "快帮我",
        "快带我",
        "不舒服",
        "站不稳",
    ],
    "出门办事": [
        "服务台",
        "厕所",
        "地铁",
        "公交",
        "问路",
        "下车",
        "扫码",
        "菜单",
        "购票",
        "车票",
        "进站",
        "改签",
        "退票",
        "付款",
        "座位",
        "前台",
        "导航",
    ],
    "手机设备": [
        "打电话",
        "发消息",
        "导航",
        "闹钟",
        "蓝牙",
        "定位",
        "手电筒",
        "相机",
        "音量",
        "免提",
        "屏幕",
        "开机",
        "关机",
    ],
    "数字时间": [
        "几点",
        "几分",
        "号码",
        "电话",
        "楼",
        "房",
        "块",
        "元",
        "点",
        "次",
        "号",
        "月",
        "周",
        "日期",
    ],
}

COMMON_USE_TERMS = [
    "请",
    "我",
    "你",
    "他",
    "她",
    "现在",
    "今天",
    "明天",
    "可以",
    "帮我",
    "一下",
    "怎么",
    "哪里",
    "需要",
    "马上",
    "先",
    "再",
    "要",
    "给我",
    "告诉我",
]

SCENE_ORDER = [
    "开口先说",
    "看病拿药",
    "家里需要",
    "紧急情况",
    "出门办事",
    "手机设备",
    "数字时间",
]

SCENE_FILE_NAMES = {
    "开口先说": "opening",
    "看病拿药": "medical",
    "家里需要": "home",
    "紧急情况": "emergency",
    "出门办事": "outing",
    "手机设备": "device",
    "数字时间": "numbers",
}

INITIALS = (
    "zh",
    "ch",
    "sh",
    "b",
    "p",
    "m",
    "f",
    "d",
    "t",
    "n",
    "l",
    "g",
    "k",
    "h",
    "j",
    "q",
    "x",
    "r",
    "z",
    "c",
    "s",
    "y",
    "w",
)


class TextHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self._parts.append(data)

    def get_text(self) -> str:
        return "\n".join(self._parts)


@dataclass(frozen=True)
class SourceSpec:
    id: str
    source: str
    scene_hint: str | None = None
    priority: float = 1.0
    usage_weight: float = 1.0
    note: str = ""


@dataclass(frozen=True)
class RawCandidate:
    text: str
    source_id: str
    source_ref: str
    scene: str
    scene_score: int
    length: int
    length_score: float
    usage_score: float
    priority: float
    usage_weight: float


@dataclass(frozen=True)
class CandidateSentence:
    id: str
    text: str
    scene: str
    length: int
    source_id: str
    source_ref: str
    scene_score: int
    length_score: float
    usage_score: float
    coverage_score: float
    total_score: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="构建中文训练页标准句库")
    parser.add_argument(
        "--source",
        action="append",
        default=[],
        help="输入源，支持本地文件路径或 URL；可多次传入",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        help="JSON manifest，可传字符串列表或对象列表",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="汇总输出 JSON 文件路径",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="按场景拆分输出的目录路径",
    )
    parser.add_argument("--min-length", type=int, default=5)
    parser.add_argument("--max-length", type=int, default=20)
    parser.add_argument("--soft-min-length", type=int, default=5)
    parser.add_argument("--soft-max-length", type=int, default=20)
    parser.add_argument("--per-scene", type=int, default=200)
    parser.add_argument("--per-source-cap", type=int, default=80)
    parser.add_argument(
        "--min-scene-score",
        type=int,
        default=1,
        help="命中至少多少个场景关键词才保留；默认 1",
    )
    return parser.parse_args()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", value.lower()).strip("_") or "source"


def infer_source_id(source: str) -> str:
    if source.startswith(("http://", "https://")):
        return slugify(source.split("//", 1)[-1].split("/", 1)[0])
    return slugify(Path(source).stem)


def parse_source_entry(entry: Any) -> SourceSpec:
    if isinstance(entry, str):
        return SourceSpec(id=infer_source_id(entry), source=entry)

    if isinstance(entry, dict):
        source = str(entry["source"])
        scene_hint = entry.get("scene_hint")
        if scene_hint is not None and scene_hint not in SCENE_ORDER:
            raise ValueError(f"不支持的 scene_hint: {scene_hint}")
        return SourceSpec(
            id=str(entry.get("id") or infer_source_id(source)),
            source=source,
            scene_hint=scene_hint,
            priority=float(entry.get("priority", 1.0)),
            usage_weight=float(entry.get("usage_weight", 1.0)),
            note=str(entry.get("note", "")),
        )

    raise TypeError(f"无法解析 source entry: {entry!r}")


def load_sources(args: argparse.Namespace) -> list[SourceSpec]:
    specs = [parse_source_entry(source) for source in args.source]
    if args.manifest:
        payload = json.loads(args.manifest.read_text(encoding="utf-8"))
        for source in payload.get("sources", []):
            specs.append(parse_source_entry(source))
    return specs


def read_source(spec: SourceSpec) -> tuple[str, str]:
    source = spec.source
    if source.startswith(("http://", "https://")):
        request = urllib.request.Request(source, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=20) as response:
            content_type = response.headers.get("Content-Type", "")
            data = response.read()
        text = data.decode("utf-8", errors="ignore")
        if "html" in content_type or "<html" in text.lower():
            parser = TextHTMLParser()
            parser.feed(text)
            return parser.get_text(), source
        return text, source

    path = Path(source)
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if path.suffix.lower() in {".json", ".jsonl"}:
        return read_json_like(raw), str(path)
    if path.suffix.lower() in {".csv", ".tsv"}:
        return read_delimited(path), str(path)
    if path.suffix.lower() in {".html", ".htm"}:
        parser = TextHTMLParser()
        parser.feed(raw)
        return parser.get_text(), str(path)
    return raw, str(path)


def read_json_like(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if raw.startswith("{") or raw.startswith("["):
        payload = json.loads(raw)
        texts: list[str] = []
        flatten_json(payload, texts)
        return "\n".join(texts)

    texts: list[str] = []
    for line in raw.splitlines():
        if not line.strip():
            continue
        try:
            flatten_json(json.loads(line), texts)
        except json.JSONDecodeError:
            continue
    return "\n".join(texts)


def flatten_json(value: object, out: list[str]) -> None:
    if isinstance(value, str):
        out.append(value)
        return
    if isinstance(value, dict):
        for nested in value.values():
            flatten_json(nested, out)
        return
    if isinstance(value, list):
        for nested in value:
            flatten_json(nested, out)


def read_delimited(path: Path) -> str:
    delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
    rows: list[str] = []
    with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        reader = csv.reader(handle, delimiter=delimiter)
        for row in reader:
            rows.extend(cell for cell in row if cell)
    return "\n".join(rows)


def normalize_text(raw: str) -> str:
    cleaned = ASCII_TOKEN_RE.sub("", raw)
    cleaned = NOISE_RE.sub("", cleaned)
    cleaned = MULTI_COMMA_RE.sub("，", cleaned)
    cleaned = SPACE_RE.sub("", cleaned)
    cleaned = cleaned.strip("，,。！？；：")
    return cleaned


def is_noise_sentence(text: str) -> bool:
    lowered = text.lower()
    if any(pattern in lowered for pattern in UI_NOISE_PATTERNS):
        return True
    if "http" in lowered or "www." in lowered:
        return True
    if text.isdigit():
        return True
    if len(text) <= 2:
        return True
    chinese_chars = chinese_length(text)
    if chinese_chars == 0:
        return True
    non_chinese_chars = len(text) - chinese_chars
    if non_chinese_chars > chinese_chars:
        return True
    if text.count("，") >= 3 and chinese_chars < 10:
        return True
    return False


def iter_sentence_units(text: str) -> list[str]:
    units: list[str] = []
    for chunk in SENTENCE_SPLIT_RE.split(text):
        normalized = normalize_text(chunk)
        if not normalized or is_noise_sentence(normalized):
            continue
        split_units: list[str] = []
        if "，" in normalized:
            for clause in CLAUSE_SPLIT_RE.split(normalized):
                sub = normalize_text(clause)
                if not sub or sub == normalized or is_noise_sentence(sub):
                    continue
                split_units.append(sub)
        if split_units and normalized.count("，") >= 2:
            units.extend(split_units)
            continue
        units.append(normalized)
        units.extend(split_units)
    return units


def chinese_length(text: str) -> int:
    return len(CHINESE_RE.findall(text))


def classify_scene(text: str, scene_hint: str | None = None) -> tuple[str, int]:
    best_scene = scene_hint if scene_hint in SCENE_ORDER else "出门办事"
    best_score = 2 if scene_hint in SCENE_ORDER else 0

    for scene, keywords in SCENE_RULES.items():
        score = sum(1 for keyword in keywords if keyword in text)
        if scene == scene_hint:
            score += 2
        if score > best_score:
            best_scene = scene
            best_score = score
    return best_scene, best_score


def build_usage_score(text: str) -> float:
    hits = sum(1 for term in COMMON_USE_TERMS if term in text)
    pronoun_bonus = 0.5 if any(term in text for term in ("我", "你", "他", "她")) else 0.0
    question_bonus = 0.4 if any(term in text for term in ("吗", "怎么", "哪里", "多少")) else 0.0
    request_bonus = 0.4 if any(term in text for term in ("请", "帮我", "可以")) else 0.0
    return round(min(3.0, hits * 0.22 + pronoun_bonus + question_bonus + request_bonus), 4)


def build_length_score(length: int, soft_min: int, soft_max: int, hard_min: int, hard_max: int) -> float:
    if soft_min <= length <= soft_max:
        return 1.0
    if length < soft_min:
        span = max(1, soft_min - hard_min)
        return round(max(0.15, 1 - (soft_min - length) / span), 4)
    span = max(1, hard_max - soft_max)
    return round(max(0.15, 1 - (length - soft_max) / span), 4)


def extract_candidates(
    spec: SourceSpec,
    text: str,
    source_ref: str,
    min_length: int,
    max_length: int,
    soft_min: int,
    soft_max: int,
    min_scene_score: int,
) -> list[RawCandidate]:
    results: list[RawCandidate] = []
    for normalized in iter_sentence_units(text):
        if not CHINESE_RE.search(normalized):
            continue
        if re.search(r"[A-Za-z]{3,}", normalized):
            continue
        length = chinese_length(normalized)
        if length < min_length or length > max_length:
            continue
        scene, scene_score = classify_scene(normalized, spec.scene_hint)
        if scene_score < min_scene_score:
            continue
        results.append(
            RawCandidate(
                text=normalized,
                source_id=spec.id,
                source_ref=source_ref,
                scene=scene,
                scene_score=scene_score,
                length=length,
                length_score=build_length_score(length, soft_min, soft_max, min_length, max_length),
                usage_score=build_usage_score(normalized),
                priority=spec.priority,
                usage_weight=spec.usage_weight,
            )
        )
    return results


def try_import_pypinyin():
    try:
        from pypinyin import Style, lazy_pinyin  # type: ignore
    except Exception:
        return None, None
    return Style, lazy_pinyin


def split_pinyin_syllable(syllable: str) -> tuple[str, str, str]:
    tone = "0"
    base = syllable
    tone_match = re.search(r"([1-5])$", syllable)
    if tone_match:
        tone = tone_match.group(1)
        base = syllable[:-1]

    initial = ""
    for candidate in INITIALS:
        if base.startswith(candidate):
            initial = candidate
            break
    final = base[len(initial):] if initial else base
    return initial or "_", final or "_", tone


def build_coverage_scores(sentences: Sequence[str]) -> dict[str, float]:
    style, lazy_pinyin = try_import_pypinyin()
    if style is None or lazy_pinyin is None:
        return {sentence: 0.0 for sentence in sentences}

    initial_counter: Counter[str] = Counter()
    final_counter: Counter[str] = Counter()
    tone_counter: Counter[str] = Counter()
    sentence_profiles: dict[str, tuple[set[str], set[str], set[str]]] = {}

    for sentence in sentences:
        syllables = lazy_pinyin(sentence, style=style.TONE3, neutral_tone_with_five=True)
        initials: set[str] = set()
        finals: set[str] = set()
        tones: set[str] = set()
        for syllable in syllables:
            if not syllable:
                continue
            initial, final, tone = split_pinyin_syllable(syllable)
            initials.add(initial)
            finals.add(final)
            tones.add(tone)
        sentence_profiles[sentence] = (initials, finals, tones)
        initial_counter.update(initials)
        final_counter.update(finals)
        tone_counter.update(tones)

    scores: dict[str, float] = {}
    for sentence, (initials, finals, tones) in sentence_profiles.items():
        score = sum(1 / initial_counter[item] for item in initials)
        score += sum(1 / final_counter[item] for item in finals)
        score += sum(1 / tone_counter[item] for item in tones)
        scores[sentence] = round(score, 6)
    return scores


def build_candidate_id(scene: str, text: str) -> str:
    prefix = SCENE_FILE_NAMES[scene]
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}_{digest}"


def to_total_score(raw: RawCandidate, coverage_score: float) -> float:
    total = coverage_score * 2.1
    total += raw.scene_score * 1.25
    total += raw.length_score * 1.15
    total += raw.usage_score * 1.35 * raw.usage_weight
    total += raw.priority
    return round(total, 6)


def dedupe_raw_candidates(raw_candidates: Sequence[RawCandidate]) -> list[RawCandidate]:
    best_by_text: dict[str, RawCandidate] = {}
    for candidate in raw_candidates:
        existing = best_by_text.get(candidate.text)
        if existing is None:
            best_by_text[candidate.text] = candidate
            continue
        if (
            candidate.scene_score,
            candidate.priority,
            candidate.usage_score,
            candidate.length_score,
        ) > (
            existing.scene_score,
            existing.priority,
            existing.usage_score,
            existing.length_score,
        ):
            best_by_text[candidate.text] = candidate
    return list(best_by_text.values())


def select_scene_candidates(
    raw_candidates: Sequence[RawCandidate],
    per_scene: int,
    per_source_cap: int,
) -> tuple[dict[str, list[CandidateSentence]], dict[str, int]]:
    deduped = dedupe_raw_candidates(raw_candidates)
    coverage_scores = build_coverage_scores([candidate.text for candidate in deduped])

    buckets: dict[str, list[CandidateSentence]] = defaultdict(list)
    for candidate in deduped:
        coverage_score = coverage_scores.get(candidate.text, 0.0)
        buckets[candidate.scene].append(
            CandidateSentence(
                id=build_candidate_id(candidate.scene, candidate.text),
                text=candidate.text,
                scene=candidate.scene,
                length=candidate.length,
                source_id=candidate.source_id,
                source_ref=candidate.source_ref,
                scene_score=candidate.scene_score,
                length_score=candidate.length_score,
                usage_score=candidate.usage_score,
                coverage_score=coverage_score,
                total_score=to_total_score(candidate, coverage_score),
            )
        )

    selected: dict[str, list[CandidateSentence]] = {}
    stats: dict[str, int] = {}
    for scene in SCENE_ORDER:
        source_counter: Counter[str] = Counter()
        chosen: list[CandidateSentence] = []
        ordered = sorted(
            buckets.get(scene, []),
            key=lambda item: (-item.total_score, item.length, item.text),
        )
        for item in ordered:
            if len(chosen) >= per_scene:
                break
            if source_counter[item.source_id] >= per_source_cap:
                continue
            chosen.append(item)
            source_counter[item.source_id] += 1
        selected[scene] = chosen
        stats[scene] = len(chosen)
    return selected, stats


def write_outputs(
    selected: dict[str, list[CandidateSentence]],
    stats: dict[str, int],
    raw_count: int,
    deduped_count: int,
    output: Path,
    output_dir: Path | None,
    sources: Sequence[SourceSpec],
    args: argparse.Namespace,
) -> None:
    manifest_sources = [asdict(source) for source in sources]
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "preferred_length_range": [args.soft_min_length, args.soft_max_length],
        "hard_length_range": [args.min_length, args.max_length],
        "sources": manifest_sources,
        "stats": {
            "raw_candidates": raw_count,
            "deduped_candidates": deduped_count,
            "scene_counts": stats,
        },
        "scenes": {
            scene: [asdict(item) for item in items]
            for scene, items in selected.items()
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        for scene, items in selected.items():
            file_name = f"{SCENE_FILE_NAMES[scene]}.json"
            scene_payload = {
                "scene": scene,
                "preferred_length_range": [args.soft_min_length, args.soft_max_length],
                "count": len(items),
                "items": [asdict(item) for item in items],
            }
            (output_dir / file_name).write_text(
                json.dumps(scene_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )


def main() -> int:
    args = parse_args()
    sources = load_sources(args)
    if not sources:
        print("请至少提供一个 --source 或 --manifest。", file=sys.stderr)
        return 1

    raw_candidates: list[RawCandidate] = []
    for spec in sources:
        try:
            text, source_ref = read_source(spec)
            raw_candidates.extend(
                extract_candidates(
                    spec=spec,
                    text=text,
                    source_ref=source_ref,
                    min_length=args.min_length,
                    max_length=args.max_length,
                    soft_min=args.soft_min_length,
                    soft_max=args.soft_max_length,
                    min_scene_score=args.min_scene_score,
                )
            )
        except Exception as exc:
            print(f"[warn] 跳过 {spec.source}: {exc}", file=sys.stderr)

    deduped_count = len({candidate.text for candidate in raw_candidates})
    selected, stats = select_scene_candidates(
        raw_candidates=raw_candidates,
        per_scene=args.per_scene,
        per_source_cap=args.per_source_cap,
    )
    write_outputs(
        selected=selected,
        stats=stats,
        raw_count=len(raw_candidates),
        deduped_count=deduped_count,
        output=args.output,
        output_dir=args.output_dir,
        sources=sources,
        args=args,
    )

    print(f"已输出到 {args.output}")
    if args.output_dir:
        print(f"场景文件目录：{args.output_dir}")
    print(f"推荐句长范围：{args.soft_min_length}-{args.soft_max_length} 个汉字")
    for scene in SCENE_ORDER:
        print(f"- {scene}: {stats.get(scene, 0)} 句")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
