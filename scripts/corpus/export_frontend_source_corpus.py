#!/usr/bin/env python3
"""
Export a frontend Mandarin training corpus from traceable source texts only.

This script deliberately avoids prompt templates. It accepts already-built
scene/phonology corpora plus optional local manifests, then filters, dedupes,
balances, and writes the JSON shape consumed by the training page.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

try:
    from opencc import OpenCC
except ImportError:  # pragma: no cover - optional offline corpus dependency
    OpenCC = None  # type: ignore[assignment]

from build_mandarin_scene_corpus import (
    build_coverage_scores,
    build_length_score,
    chinese_length,
    classify_scene,
    iter_sentence_units,
    parse_source_entry,
    read_source,
)


CATEGORY_ORDER = [
    "日常与出行",
    "看病与求助",
    "人群与角色",
    "设备与数字",
    "现代文章朗读",
    "文言文节奏",
]

SCENE_TO_CATEGORY = {
    "开口先说": "日常与出行",
    "家里需要": "日常与出行",
    "出门办事": "日常与出行",
    "看病拿药": "看病与求助",
    "紧急情况": "看病与求助",
    "手机设备": "设备与数字",
    "数字时间": "设备与数字",
}

SOURCE_CATEGORY_HINTS = {
    "childmandarin": "人群与角色",
    "classroom": "人群与角色",
    "caregiver": "人群与角色",
    "elder": "人群与角色",
    "nurse": "人群与角色",
    "pep_textbook": "人群与角色",
    "customer_service": "人群与角色",
    "pts_reading": "现代文章朗读",
    "shenglv": "文言文节奏",
    "liweng": "文言文节奏",
    "mulan": "文言文节奏",
    "taohuayuan": "文言文节奏",
    "yueyang": "文言文节奏",
    "zuoweng": "文言文节奏",
    "lanting": "文言文节奏",
    "chushibiao": "文言文节奏",
    "tengwang": "文言文节奏",
}

DEFAULT_CAPS = {
    "日常与出行": 180,
    "看病与求助": 120,
    "人群与角色": 180,
    "设备与数字": 180,
    "现代文章朗读": 560,
    "文言文节奏": 240,
}

OPENCC_T2S = OpenCC("t2s") if OpenCC is not None else None

CATEGORY_SOURCE_SOFT_CAPS = {
    "现代文章朗读": 120,
    "文言文节奏": 80,
}

BLOCK_PATTERNS = (
    "app下载",
    "ai全流程",
    "cookie",
    "iphone",
    "ipad",
    "pmp",
    "扫码",
    "关注",
    "客服热线",
    "在线客服",
    "公众号",
    "下载app",
    "登录",
    "注册",
    "验证码",
    "隐私",
    "协议",
    "版权",
    "版权所有",
    "网站",
    "网页",
    "页面",
    "官方支持",
    "使用手册",
    "当前位置",
    "上一篇",
    "下一篇",
    "相关阅读",
    "推荐阅读",
    "延伸阅读",
    "免费",
    "内购买",
    "专为设计",
    "信息公开",
    "信息来源",
    "发布日期",
    "来源",
    "浏览量",
    "点击",
    "返回",
    "查看",
    "搜索",
    "输入",
    "选择",
    "修改这个控件",
    "自动更新",
    "窗口",
    "菜单",
    "备案",
    "营业执照",
    "出版物经营",
    "风险提示",
    "不构成建议",
    "最终真实收益",
    "收益承诺",
    "权威部门",
    "教师资格",
    "小学教师",
    "中学综合素质",
    "初中学科",
    "学科知识",
    "综合素质",
    "幼儿综合素质",
    "确认通过",
    "备考",
    "告别盲目",
    "刷题",
    "快人一步",
    "在线老师",
    "在线咨询",
    "咨询在线",
    "加入收藏",
    "收藏本站",
    "希赛",
    "育路",
    "考生",
    "题库",
    "课程",
    "资料",
    "证书",
    "考试时间",
    "报名",
    "学员",
    "兑换码",
    "维基",
    "自由的图书馆",
    "图书馆",
    "在其他项目中",
    "维基数据项目",
    "子章节",
    "开关卷",
    "明朝作品",
    "全世界都属于",
    "公共领域",
    "许可协议",
    "原文",
    "本作品",
    "阅论编",
    "图片",
    "image",
    "button",
    "申请表",
    "许可证",
    "协议管理",
    "项目名称",
    "子项名称",
    "联系方式",
    "希望我们通过哪种方式",
    "主编",
    "节选",
    "节先自",
    "费舍尔",
    "达瑞的故事",
    "风筝畅想曲",
    "儿童挣钱",
    "白话文废话",
    "屯將",
    "曲长屯",
    "三国志",
    "明並日月",
    "卷第",
    "正倉院",
    "狡猾",
    "权力屈服",
)

BAD_PREFIXES = tuple("的了和与及或并而但却则又也就都将把被在对从向以由为其此该本等号")
BAD_SUFFIXES = tuple("的和与及或并而但却则将把被在对从向以由为")

TRADITIONAL_MAP = str.maketrans(
    {
        "國": "国",
        "與": "与",
        "雲": "云",
        "觀": "观",
        "賊": "贼",
        "適": "适",
        "於": "于",
        "傷": "伤",
        "靈": "灵",
        "聞": "闻",
        "騎": "骑",
        "陰": "阴",
        "陽": "阳",
        "賢": "贤",
        "後": "后",
        "內": "内",
        "異": "异",
        "稱": "称",
        "謹": "谨",
        "計": "计",
        "難": "难",
        "補": "补",
        "闕": "缺",
        "氣": "气",
        "餘": "余",
        "論": "论",
        "詔": "诏",
        "吳": "吴",
        "違": "违",
        "據": "据",
        "敗": "败",
        "鈍": "钝",
        "損": "损",
        "無": "无",
        "興": "兴",
        "陳": "陈",
        "諸": "诸",
        "則": "则",
        "聖": "圣",
        "臨": "临",
        "遠": "远",
        "離": "离",
        "涕": "涕",
        "隂": "阴",
        "敘": "叙",
        "並": "并",
        "開": "开",
        "關": "关",
        "書": "书",
        "讀": "读",
        "處": "处",
        "語": "语",
        "聲": "声",
        "韻": "韵",
        "歲": "岁",
        "夢": "梦",
        "歸": "归",
        "風": "风",
        "華": "华",
        "東": "东",
        "萬": "万",
        "長": "长",
        "學": "学",
        "臺": "台",
        "蘭": "兰",
        "懷": "怀",
        "懐": "怀",
        "扵": "于",
        "爲": "为",
        "為": "为",
        "覺": "觉",
        "說": "说",
        "聽": "听",
        "應": "应",
        "醫": "医",
        "藥": "药",
        "婦": "妇",
        "兒": "儿",
        "時": "时",
        "間": "间",
        "現": "现",
        "點": "点",
        "帶": "带",
        "幫": "帮",
        "請": "请",
        "讓": "让",
        "這": "这",
        "個": "个",
        "們": "们",
        "會": "会",
        "來": "来",
        "車": "车",
        "話": "话",
        "發": "发",
        "電": "电",
        "號": "号",
        "門": "门",
        "樓": "楼",
        "亂": "乱",
        "傳": "传",
        "兩": "两",
        "冊": "册",
        "勝": "胜",
        "喚": "唤",
        "嘗": "尝",
        "圖": "图",
        "報": "报",
        "壯": "壮",
        "將": "将",
        "宮": "宫",
        "廬": "庐",
        "張": "张",
        "從": "从",
        "復": "复",
        "慮": "虑",
        "憶": "忆",
        "戰": "战",
        "戶": "户",
        "撲": "扑",
        "攬": "揽",
        "敵": "敌",
        "暢": "畅",
        "業": "业",
        "極": "极",
        "樂": "乐",
        "機": "机",
        "殤": "殇",
        "洩": "泄",
        "漢": "汉",
        "濺": "溅",
        "營": "营",
        "爺": "爷",
        "猶": "犹",
        "畢": "毕",
        "畫": "画",
        "當": "当",
        "盡": "尽",
        "簡": "简",
        "紅": "红",
        "終": "终",
        "絕": "绝",
        "絲": "丝",
        "織": "织",
        "脫": "脱",
        "腳": "脚",
        "蓋": "盖",
        "虛": "虚",
        "見": "见",
        "視": "视",
        "親": "亲",
        "觴": "觞",
        "討": "讨",
        "託": "托",
        "許": "许",
        "訴": "诉",
        "詩": "诗",
        "該": "该",
        "誕": "诞",
        "誠": "诚",
        "諮": "咨",
        "豬": "猪",
        "責": "责",
        "買": "买",
        "賞": "赏",
        "跡": "迹",
        "軍": "军",
        "載": "载",
        "轡": "辔",
        "辭": "辞",
        "連": "连",
        "週": "周",
        "達": "达",
        "遺": "遗",
        "邊": "边",
        "錄": "录",
        "鐵": "铁",
        "閣": "阁",
        "際": "际",
        "隨": "随",
        "雖": "虽",
        "韉": "鞯",
        "領": "领",
        "頭": "头",
        "願": "愿",
        "類": "类",
        "顧": "顾",
        "飛": "飞",
        "馬": "马",
        "馳": "驰",
        "駿": "骏",
        "騁": "骋",
        "驅": "驱",
        "鳴": "鸣",
        "黃": "黄",
        "齊": "齐",
        "龜": "龟",
        "僞": "伪",
        "創": "创",
        "娛": "娱",
        "妝": "妆",
        "爾": "尔",
        "窺": "窥",
        "舊": "旧",
        "舎": "舍",
        "衞": "卫",
        "覩": "睹",
        "遊": "游",
        "歎": "叹",
        "羣": "群",
        "円": "元",
        "脩": "修",
        "稧": "禊",
    }
)


def to_simplified_chinese(raw: str) -> str:
    text = OPENCC_T2S.convert(raw) if OPENCC_T2S is not None else raw
    return text.translate(TRADITIONAL_MAP)


@dataclass(frozen=True)
class SourceItem:
    text: str
    category: str
    source_id: str
    source_ref: str
    score: float
    length: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导出前端训练页真实来源句库")
    parser.add_argument("--scene-corpus", action="append", type=Path, default=[])
    parser.add_argument("--phonology-corpus", action="append", type=Path, default=[])
    parser.add_argument("--manifest", action="append", type=Path, default=[])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--min-length", type=int, default=6)
    parser.add_argument("--max-length", type=int, default=16)
    parser.add_argument("--per-source-cap", type=int, default=140)
    parser.add_argument("--cap", action="append", default=[], help="分类上限，如 现代文章朗读=560")
    return parser.parse_args()


def parse_caps(values: Iterable[str]) -> dict[str, int]:
    caps = dict(DEFAULT_CAPS)
    for value in values:
        if "=" not in value:
            raise ValueError(f"cap 必须是 分类=数字: {value}")
        category, raw_count = value.split("=", 1)
        if category not in caps:
            raise ValueError(f"未知分类: {category}")
        caps[category] = int(raw_count)
    return caps


def visible_text(raw: str) -> str:
    text = to_simplified_chinese(raw)
    text = text.replace("//", "")
    text = re.sub(r"[“”\"'‘’《》〈〉【】\[\]()（）·…—\-]", "", text)
    text = re.sub(r"[，,、：:/／；;。！？!?\\s]+", "", text)
    return text.strip()


def is_bad_text(text: str) -> bool:
    if not text:
        return True
    lowered = text.lower()
    if any(pattern in lowered for pattern in BLOCK_PATTERNS):
        return True
    if re.search(r"[A-Za-z0-9]", text):
        return True
    if re.search(r"[^\u4e00-\u9fff]", text):
        return True
    length = chinese_length(text)
    if length < 6 or length > 16:
        return True
    if text.startswith(BAD_PREFIXES) or text.endswith(BAD_SUFFIXES):
        return True
    if text.count("我") >= 3 or text.count("你") >= 3:
        return True
    if len(set(text)) <= 3:
        return True
    return False


def category_for_source(source_id: str, text: str) -> str:
    lowered = source_id.lower()
    for marker, category in SOURCE_CATEGORY_HINTS.items():
        if marker in lowered:
            return category
    if any(term in text for term in ("医生", "护士", "吃药", "用药", "急救", "生病", "发烧", "疼痛", "拉肚子", "排尿")):
        return "看病与求助"
    if any(
        term in text
        for term in (
            "妈妈",
            "爸爸",
            "父亲",
            "母亲",
            "老师",
            "同学",
            "学生",
            "朋友",
            "同事",
            "老板",
            "孩子",
            "儿子",
            "女儿",
            "妹妹",
            "哥哥",
            "姐姐",
            "邻居",
            "服务生",
        )
    ):
        return "人群与角色"
    if any(
        term in text
        for term in (
            "电话",
            "手机",
            "相机",
            "电视",
            "房间号",
            "几点",
            "几月",
            "周一",
            "周二",
            "周三",
            "周四",
            "周五",
            "周六",
            "周日",
            "星期",
            "元",
            "块钱",
            "楼",
        )
    ):
        return "设备与数字"
    return "日常与出行"


def load_scene_corpus(path: Path) -> list[SourceItem]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows: list[SourceItem] = []
    for scene, scene_payload in payload.get("scenes", {}).items():
        category = SCENE_TO_CATEGORY.get(scene)
        if category is None:
            continue
        items = scene_payload.get("items", []) if isinstance(scene_payload, dict) else scene_payload
        for item in items:
            text = visible_text(str(item.get("text", "")))
            if is_bad_text(text):
                continue
            length = chinese_length(text)
            rows.append(
                SourceItem(
                    text=text,
                    category=category,
                    source_id=str(item.get("source_id", "unknown")),
                    source_ref=str(item.get("source_ref", path)),
                    score=float(item.get("total_score", 0.0)) + float(item.get("usage_score", 0.0)),
                    length=length,
                )
            )
    return rows


def load_phonology_corpus(path: Path) -> list[SourceItem]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows: list[SourceItem] = []
    for item in payload.get("items", []):
        text = visible_text(str(item.get("text", "")))
        if is_bad_text(text):
            continue
        rows.append(
            SourceItem(
                text=text,
                category=category_for_source(str(item.get("source_id", "phonology")), text),
                source_id=str(item.get("source_id", "phonology")),
                source_ref=str(item.get("source_ref", path)),
                score=float(item.get("total_score", 0.0)),
                length=chinese_length(text),
            )
        )
    return rows


def load_manifest(path: Path, per_source_cap: int, min_length: int, max_length: int) -> list[SourceItem]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows: list[SourceItem] = []
    for raw_entry in payload.get("sources", []):
        spec = parse_source_entry(raw_entry)
        try:
            units, source_ref = iter_manifest_units(spec)
        except Exception as exc:
            print(f"[warn] 跳过 {spec.id}: {exc}")
            continue

        source_rows: list[SourceItem] = []
        seen: set[str] = set()
        for unit in units:
            visible = visible_text(unit)
            length = chinese_length(visible)
            if length < min_length or length > max_length:
                continue
            if is_bad_text(visible) or visible in seen:
                continue
            if spec.id == "tatoeba_cmn_example_sentences" and not is_frontend_usable_example(visible):
                continue
            seen.add(visible)
            category = category_for_source(spec.id, visible)
            coverage_seed = build_length_score(length, min_length, max_length, min_length, max_length)
            source_rows.append(
                SourceItem(
                    text=visible,
                    category=category,
                    source_id=spec.id,
                    source_ref=source_ref,
                    score=coverage_seed * spec.priority * spec.usage_weight,
                    length=length,
                )
            )
            if len(source_rows) >= per_source_cap:
                break
        rows.extend(source_rows)
    return rows


def is_frontend_usable_example(text: str) -> bool:
    reject_terms = (
        "德国人",
        "法国人",
        "意大利人",
        "日本人",
        "英国人",
        "美国人",
        "总统",
        "政府",
        "战争",
        "杀",
        "死亡",
        "淹死",
        "毒",
        "偷",
        "罪",
        "宗教",
        "上帝",
        "法语",
        "德语",
        "英语",
        "美国",
        "法国",
        "西雅图",
        "温哥华",
        "希腊",
        "杰克",
        "变疯",
        "虐待动物",
        "拉我的腿",
        "月经",
        "抛弃",
        "税收",
        "戒酒",
        "戒烟",
        "吸烟",
        "职业是医生",
        "成为一名医生",
        "嫁给了一个医生",
        "视为村里",
        "动物园",
    )
    if any(term in text for term in reject_terms):
        return False

    usable_terms = (
        "我",
        "你",
        "您",
        "请",
        "可以",
        "能",
        "要",
        "想",
        "需要",
        "知道",
        "告诉",
        "帮",
        "吗",
        "哪",
        "什么",
        "怎么",
        "多少",
        "今天",
        "明天",
        "现在",
        "昨天",
        "电话",
        "房间",
        "门",
        "车",
        "火车",
        "公交",
        "车站",
        "钱",
        "医生",
        "护士",
        "老师",
        "同学",
        "朋友",
        "妈妈",
        "爸爸",
        "孩子",
        "服务生",
    )
    return any(term in text for term in usable_terms)


def iter_manifest_units(spec: Any) -> tuple[list[str], str]:
    source = str(spec.source)
    if spec.id == "tatoeba_cmn_example_sentences" and source.endswith(".tsv"):
        rows: list[str] = []
        with Path(source).open("r", encoding="utf-8", errors="ignore", newline="") as handle:
            reader = csv.reader(handle, delimiter="\t")
            for row in reader:
                if len(row) >= 2 and row[1] != "Simplified":
                    rows.append(row[1])
        return rows, source

    text, source_ref = read_source(spec)
    return iter_sentence_units(text), source_ref


def rebalance(rows: list[SourceItem], caps: dict[str, int]) -> dict[str, list[SourceItem]]:
    deduped: dict[tuple[str, str], SourceItem] = {}
    coverage_scores = build_coverage_scores([row.text for row in rows])

    for row in rows:
        score = row.score + coverage_scores.get(row.text, 0.0) * 2
        boosted = SourceItem(
            text=row.text,
            category=row.category,
            source_id=row.source_id,
            source_ref=row.source_ref,
            score=round(score, 6),
            length=row.length,
        )
        key = (row.category, row.text)
        previous = deduped.get(key)
        if previous is None or boosted.score > previous.score:
            deduped[key] = boosted

    grouped: dict[str, list[SourceItem]] = {category: [] for category in CATEGORY_ORDER}
    for row in deduped.values():
        if row.category in grouped:
            grouped[row.category].append(row)

    balanced: dict[str, list[SourceItem]] = {}
    for category, category_rows in grouped.items():
        ordered = sorted(
            category_rows,
            key=lambda item: (
                -item.score,
                item.source_id,
                item.length,
                item.text,
            ),
        )
        soft_cap = CATEGORY_SOURCE_SOFT_CAPS.get(category)
        if soft_cap is None:
            balanced[category] = ordered[: caps[category]]
            continue

        selected: list[SourceItem] = []
        deferred: list[SourceItem] = []
        source_counts: dict[str, int] = {}
        for item in ordered:
            if len(selected) >= caps[category]:
                break
            count = source_counts.get(item.source_id, 0)
            if count < soft_cap:
                selected.append(item)
                source_counts[item.source_id] = count + 1
            else:
                deferred.append(item)

        if len(selected) < caps[category]:
            selected.extend(deferred[: caps[category] - len(selected)])

        balanced[category] = selected[: caps[category]]
    return balanced


def frontend_payload(grouped: dict[str, list[SourceItem]], args: argparse.Namespace) -> dict[str, Any]:
    categories: dict[str, Any] = {}
    sources: dict[str, int] = {}
    for category in CATEGORY_ORDER:
        items = []
        for index, item in enumerate(grouped.get(category, []), start=1):
            sources[item.source_id] = sources.get(item.source_id, 0) + 1
            items.append(
                {
                    "id": f"{category}_source_{index:04d}",
                    "text": item.text,
                    "category": category,
                }
            )
        categories[category] = {
            "count": len(items),
            "items": items,
        }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "kind": "source_extracted_mandarin_training_corpus",
        "generated_from": {
            "builder": "scripts/corpus/export_frontend_source_corpus.py",
            "scene_corpora": [str(path) for path in args.scene_corpus],
            "phonology_corpora": [str(path) for path in args.phonology_corpus],
            "manifests": [str(path) for path in args.manifest],
            "source_item_counts": dict(sorted(sources.items())),
        },
        "policy": {
            "template_generation": False,
            "length_range": [args.min_length, args.max_length],
            "source_text_only": True,
            "filters": [
                "reject ASCII/digits in source-derived frontend prompts",
                "reject page/navigation/metadata fragments",
                "reject dangling Chinese function-word prefixes/suffixes",
                "dedupe per category by target text",
            ],
        },
        "categories": categories,
    }


def main() -> int:
    args = parse_args()
    caps = parse_caps(args.cap)
    rows: list[SourceItem] = []

    for path in args.scene_corpus:
        rows.extend(load_scene_corpus(path))
    for path in args.phonology_corpus:
        rows.extend(load_phonology_corpus(path))
    for path in args.manifest:
        rows.extend(load_manifest(path, args.per_source_cap, args.min_length, args.max_length))

    grouped = rebalance(rows, caps)
    payload = frontend_payload(grouped, args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"已输出到 {args.output}")
    for category in CATEGORY_ORDER:
        print(f"{category}: {payload['categories'][category]['count']}")
    print("总数:", sum(payload["categories"][category]["count"] for category in CATEGORY_ORDER))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
