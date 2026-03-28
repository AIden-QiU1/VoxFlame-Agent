#!/usr/bin/env python3
"""
把真实抓取/打散后的中文语料导出成前端训练页可直接消费的 JSON 文件。

输出目标：
- 前端直接依赖真实抓取与经典文章打散的产物
- 统一成训练页现役的大类
- 在导出阶段做一轮更严格的脏句过滤，减少网页说明文进入前端
"""

from __future__ import annotations

import argparse
import json
import os
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

from build_mandarin_scene_corpus import (
    chinese_length,
    iter_sentence_units,
    parse_source_entry,
    read_source,
)

MIN_LENGTH = 5
MAX_LENGTH = 20
LEADING_INDEX_RE = re.compile(r"^(?:[0-9]{1,2}(?=[\u4e00-\u9fff])|[0-9一二三四五六七八九十]+[.、，])")


def ensure_pypinyin() -> tuple[Any, Any]:
    vendor = os.environ.get("VOXFLAME_PYPINYIN_PATH")
    if vendor:
        import sys

        sys.path.insert(0, vendor)

    from pypinyin import Style, pinyin  # type: ignore

    return Style, pinyin


@dataclass(frozen=True)
class FrontendExercise:
    id: str
    text: str
    pinyin: str
    category: str


@dataclass(frozen=True)
class RawSentence:
    text: str
    source_id: str
    source_ref: str


@dataclass(frozen=True)
class CategoryRule:
    name: str
    source_ids: tuple[str, ...]
    required_terms: tuple[str, ...]
    preferred_terms: tuple[str, ...]
    blocked_terms: tuple[str, ...]
    per_source_cap: int
    limit: int


DAILY_OUTING_RULE = CategoryRule(
    name="日常与出行",
    source_ids=(
        "chinese_aac_app_store",
        "mccsd_2024",
        "apple_siri_calls_messages",
        "apple_messages",
        "apple_carplay_messages",
        "apple_driving_focus",
    ),
    required_terms=(
        "我",
        "你",
        "请",
        "帮",
        "说",
        "听",
        "告诉",
        "需要",
        "想",
        "哪里",
        "怎么",
        "可以",
        "朋友",
        "老师",
        "家里",
        "公交",
        "地铁",
        "位置",
        "电话",
        "短信",
        "回复",
        "发送",
        "联系",
        "见面",
        "接你",
        "道路救援",
    ),
    preferred_terms=(
        "我",
        "你",
        "请",
        "帮我",
        "可以",
        "再说一次",
        "我需要",
        "我想",
        "朋友",
        "老师",
        "家里",
        "公交",
        "地铁",
        "见面",
        "接你",
        "发送信息",
        "回复信息",
        "拨打",
        "发信息",
        "位置",
        "道路救援",
    ),
    blocked_terms=(
        ">",
        "<",
        "智能与",
        "订阅",
        "试用",
        "应用",
        "用户",
        "家长了解",
        "重新调整",
        "文案",
        "评论",
        "官方支持",
        "兼容",
        "使用手册",
        "设置基础功能",
        "账户",
        "电池",
        "充电",
        "资源库",
        "灵动岛",
        "手势",
        "蜂窝",
        "互联网",
        "邮件",
        "通讯录",
        "日历",
        "屏幕",
        "相机",
        "主屏幕",
        "基础知识",
        "键盘",
        "盲文",
        "收件人栏",
        "模糊背景",
        "表情符号",
        "播客",
        "密码",
        "健康数据",
        "月经周期",
        "药品",
        "耳机",
        "蓝牙配件",
        "车载蓝牙系统",
        "紧急联络",
        "图像以及更多内容",
        "一人或多人",
        "自动回复信息进行自定义",
        "单线回复",
        "建议回复",
        "退票",
        "改签",
        "购票",
        "车票",
        "网站",
        "订单",
        "价格",
        "须知",
        "旅客",
        "周岁",
        "儿童",
        "铁路",
        "设置和查看医疗急救卡",
    ),
    per_source_cap=28,
    limit=80,
)

CARE_RULE = CategoryRule(
    name="看病与求助",
    source_ids=(
        "redcross_aed_usage",
        "medical_insurance_service_guide",
        "apple_siri_calls_messages",
    ),
    required_terms=(
        "急",
        "救",
        "药",
        "病",
        "医院",
        "医生",
        "门诊",
        "住院",
        "病历",
        "诊断",
        "用药",
        "帮助",
        "呼叫",
        "救援",
        "不舒服",
        "难受",
    ),
    preferred_terms=(
        "求助",
        "拨打120",
        "急救电话",
        "急诊",
        "门诊",
        "病历",
        "诊断证明",
        "用药",
        "道路救援",
        "呼叫",
        "帮助",
        "救护",
        "生命",
    ),
    blocked_terms=(
        "许可证",
        "申请表",
        "协议管理",
        "定点",
        "零售药店",
        "报销",
        "电子凭证",
        "医保",
        "子项名称",
        "信息来源",
        "收费票据",
        "基金管理办法",
        "省政府令",
        "主项名称",
        "待遇核准支付",
        "身份证明系统",
        "系统已标识",
        "设置呼叫",
        "委托医院鉴定",
        "医院端办理",
        "持证救护员",
        "主题赛事",
        "39万只",
        "2.7万人",
        "一机三救",
    ),
    per_source_cap=26,
    limit=80,
)

DEVICE_NUMBER_RULE = CategoryRule(
    name="设备与数字",
    source_ids=(
        "apple_siri_calls_messages",
        "apple_messages",
        "apple_carplay_messages",
        "apple_driving_focus",
    ),
    required_terms=(
        "电话",
        "号码",
        "信息",
        "短信",
        "回复",
        "发送",
        "拨打",
        "回拨",
        "重拨",
        "定位",
        "手电筒",
        "闹钟",
        "蓝牙",
        "耳机",
        "通话",
        "听写",
        "收听",
        "语音",
    ),
    preferred_terms=(
        "拨打",
        "回拨",
        "重拨",
        "发送信息",
        "回复信息",
        "电话号码",
        "定位",
        "蓝牙",
        "闹钟",
        "手电筒",
        "耳机音量",
        "收听",
        "听写",
        "通话",
        "短信",
    ),
    blocked_terms=(
        ">",
        "<",
        "智能与",
        "官方支持",
        "兼容",
        "使用手册",
        "设置基础功能",
        "账户",
        "电池",
        "充电",
        "资源库",
        "灵动岛",
        "手势",
        "蜂窝",
        "互联网",
        "邮件",
        "通讯录",
        "日历",
        "屏幕",
        "相机",
        "主屏幕",
        "基础知识",
        "键盘",
        "盲文",
        "模糊背景",
        "表情符号",
        "播客",
        "密码",
        "健康数据",
        "月经周期",
        "药品",
        "朋友",
        "家里",
        "老师",
        "地铁",
        "公交",
        "道路救援",
        "紧急联络",
    ),
    per_source_cap=45,
    limit=160,
)

PEOPLE_ROLES_RULE = CategoryRule(
    name="人群与角色",
    source_ids=(
        "elder_friendly_language_guide",
        "elderly_homecare_services",
        "elderly_care_standard",
        "lizhi_classroom",
        "nurse_courtesy_service",
        "customer_service_phrases",
        "pep_textbook_words",
    ),
    required_terms=(
        "老师",
        "学生",
        "课堂",
        "学习",
        "老人",
        "老年",
        "护理",
        "照护",
        "问候",
        "微笑",
        "搀扶",
        "温水",
        "提问",
        "作答",
        "答题",
        "回放",
        "客服",
        "服务",
        "帮助",
        "医院",
        "家长",
    ),
    preferred_terms=(
        "学生不懂随时提问",
        "老师即时作答",
        "一句入院后亲切的问候",
        "一个温暖的微笑",
        "一个及时的搀扶",
        "一杯有爱的温水",
        "请问您有什么需要帮助的吗",
        "很高兴为您服务",
        "记录并反馈服务信息",
        "根据服务计划提供照护服务",
        "对老年人称呼要有分寸",
        "热情亲切地对待老年人",
        "帮助学生",
        "学生",
        "老师",
        "老人",
        "老年",
        "护理",
        "照护",
        "课堂",
        "服务",
        "问候",
        "提问",
        "作答",
    ),
    blocked_terms=(
        "验证码",
        "微信公众号",
        "微信服务号",
        "账号密码登录",
        "成功登录后",
        "工作站",
        "病院",
        "病区",
        "天猫旗舰店",
        "出版社",
        "工作应用",
        "智能体",
        "解决方案",
        "白皮书",
        "OCR",
        "监管",
        "风控",
        "模型",
        "平台",
        "版本",
        "隐私",
        "扫码",
        "二维码",
        "营业厅",
        "电话",
        "民政局",
        "信息公开",
        "专题",
        "知识库",
        "服务项目主要内容",
        "中央部委动态",
        "北京日报",
        "评分及评论",
        "互联网服务条款",
        "开发者",
        "学子感激不尽",
        "更多行业方案",
        "App",
        "免费",
        "数字资源",
        "小盒老师",
        "关注和提问",
        "最优质的服务",
        "最全面的服务",
        "最贴心的服务",
        "服务体验",
        "服务保障",
    ),
    per_source_cap=18,
    limit=80,
)

PHONOLOGY_BLOCKED_TERMS = (
    "詩序",
    "诗序",
    "維基",
    "维基",
    "原文",
    "注释",
    "注音",
    "目录",
    "第1页",
    "第2页",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导出前端真实中文训练语料")
    parser.add_argument("--daily-outing-fetch", type=Path, required=True)
    parser.add_argument("--core-fetch", type=Path, required=True)
    parser.add_argument("--people-roles-fetch", type=Path, required=True)
    parser.add_argument("--phonology", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def to_pinyin(text: str, style: Any, pinyin_fn: Any) -> str:
    syllables = pinyin_fn(text, style=style.TONE, heteronym=False, errors=lambda _: [""])
    return " ".join(item[0] for item in syllables if item and item[0]).strip()


def normalize_export_text(text: str) -> str:
    cleaned = LEADING_INDEX_RE.sub("", text).strip()
    return cleaned.strip("，,。；;：: ")


def load_manifest_sentences(path: Path) -> dict[str, list[RawSentence]]:
    payload = load_json(path)
    by_source: dict[str, list[RawSentence]] = {}

    for entry in payload.get("sources", []):
        spec = parse_source_entry(entry)
        text, source_ref = read_source(spec)
        seen: set[str] = set()
        rows: list[RawSentence] = []
        for unit in iter_sentence_units(text):
            normalized = normalize_export_text(unit)
            if not normalized:
                continue
            if normalized in seen:
                continue
            length = chinese_length(normalized)
            if length < MIN_LENGTH or length > MAX_LENGTH:
                continue
            seen.add(normalized)
            rows.append(
                RawSentence(
                    text=normalized,
                    source_id=spec.id,
                    source_ref=source_ref,
                )
            )
        by_source[spec.id] = rows

    return by_source


def contains_any(text: str, patterns: Iterable[str]) -> bool:
    return any(pattern in text for pattern in patterns)


def score_sentence(text: str, preferred_terms: Iterable[str]) -> float:
    score = 0.0
    score += sum(1.0 for term in preferred_terms if term in text)
    score += 0.5 if any(term in text for term in ("我", "你", "请")) else 0.0
    score += 0.45 if any(term in text for term in ("吗", "怎么", "哪里")) else 0.0
    score += 0.35 if any(term in text for term in ("帮", "告诉", "回复", "发送", "拨打")) else 0.0
    score += 0.25 if 6 <= chinese_length(text) <= 14 else 0.0
    score += 1.4 if any(term in text for term in ("我需要", "我想", "再说一次", "帮我", "请")) else 0.0
    score -= 1.3 if text.startswith("你可以") else 0.0
    score -= 1.5 if text.startswith(("2，", "3，", "4，", "5，", "后，")) else 0.0
    return score


def select_category_sentences(
    by_source: dict[str, list[RawSentence]],
    rule: CategoryRule,
    style: Any,
    pinyin_fn: Any,
) -> list[FrontendExercise]:
    candidates: list[tuple[float, int, str, RawSentence]] = []

    for source_rank, source_id in enumerate(rule.source_ids):
        for row in by_source.get(source_id, []):
            text = row.text
            if contains_any(text, rule.blocked_terms):
                continue
            if not contains_any(text, rule.required_terms):
                continue
            score = score_sentence(text, rule.preferred_terms)
            score += max(0, len(rule.source_ids) - source_rank) * 0.08
            candidates.append((score, chinese_length(text), source_id, row))

    chosen: list[FrontendExercise] = []
    seen_texts: set[str] = set()
    per_source_counts: dict[str, int] = {}

    for _, _, source_id, row in sorted(candidates, key=lambda item: (-item[0], item[1], item[3].text)):
        if len(chosen) >= rule.limit:
            break
        if row.text in seen_texts:
            continue
        current_count = per_source_counts.get(source_id, 0)
        if current_count >= rule.per_source_cap:
            continue
        seen_texts.add(row.text)
        per_source_counts[source_id] = current_count + 1
        chosen.append(
            FrontendExercise(
                id=f"{rule.name}_{len(chosen) + 1:03d}",
                text=row.text,
                pinyin=to_pinyin(row.text, style, pinyin_fn),
                category=rule.name,
            )
        )

    return chosen


def build_phonology(
    phonology_payload: dict[str, Any],
    style: Any,
    pinyin_fn: Any,
) -> list[FrontendExercise]:
    chosen: list[FrontendExercise] = []
    seen: set[str] = set()

    for item in phonology_payload.get("items", []):
        text = str(item.get("text", "")).strip()
        if not text or text in seen:
            continue
        if contains_any(text, PHONOLOGY_BLOCKED_TERMS):
            continue
        seen.add(text)
        chosen.append(
            FrontendExercise(
                id=f"发音与朗读_{len(chosen) + 1:03d}",
                text=text,
                pinyin=to_pinyin(text, style, pinyin_fn),
                category="发音与朗读",
            )
        )

    return chosen


def main() -> int:
    args = parse_args()
    style, pinyin_fn = ensure_pypinyin()
    daily_outing = load_manifest_sentences(args.daily_outing_fetch)
    core_fetch = load_manifest_sentences(args.core_fetch)
    people_roles = load_manifest_sentences(args.people_roles_fetch)
    phonology = load_json(args.phonology)

    categories = {
        DAILY_OUTING_RULE.name: select_category_sentences(daily_outing, DAILY_OUTING_RULE, style, pinyin_fn),
        CARE_RULE.name: select_category_sentences(core_fetch, CARE_RULE, style, pinyin_fn),
        PEOPLE_ROLES_RULE.name: select_category_sentences(people_roles, PEOPLE_ROLES_RULE, style, pinyin_fn),
        DEVICE_NUMBER_RULE.name: select_category_sentences(
            daily_outing,
            DEVICE_NUMBER_RULE,
            style,
            pinyin_fn,
        ),
        "发音与朗读": build_phonology(phonology, style, pinyin_fn),
    }

    payload = {
        "generated_from": {
            "daily_outing_fetch": str(args.daily_outing_fetch),
            "core_fetch": str(args.core_fetch),
            "people_roles_fetch": str(args.people_roles_fetch),
            "phonology": str(args.phonology),
        },
        "categories": {
            name: {
                "count": len(items),
                "items": [asdict(item) for item in items],
            }
            for name, items in categories.items()
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    for name, items in categories.items():
        print(f"{name}: {len(items)}")
    print(f"已输出到 {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
