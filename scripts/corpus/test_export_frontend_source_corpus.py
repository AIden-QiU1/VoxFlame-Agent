#!/usr/bin/env python3

import sys
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from export_frontend_source_corpus import SEVERE_REJECTION_REASONS, rejection_reason
from clean_generated_training_corpus import clean_payload, merge_audits


class SevereCorpusQualityTest(unittest.TestCase):
    def test_rejects_only_clear_severe_pollution(self) -> None:
        cases = {
            "他来到了一个新世界阴道": "adult_or_sexual",
            "安排女明星女模特与他发生性关系": "adult_or_sexual",
            "警方也确认了吕某遇害的消息": "crime_violence_or_accident",
            "一键领取新人专享大礼包": "commercial_or_advertising",
            "基金从业考试真题": "commercial_or_advertising",
            "我们为为什么要用药呢": "asr_disfluency_or_duplication",
            "我们希望达成的是": "severe_broken_fragment",
            "基金从业考试历年真题": "commercial_or_advertising",
            "软考各科目自学必备学习包": "commercial_or_advertising",
            "初级护师学习包": "commercial_or_advertising",
            "中医护师学习包": "commercial_or_advertising",
            "护理培训资料包": "commercial_or_advertising",
            "所以你看这是出出门就是在学习": "asr_disfluency_or_duplication",
        }

        for text, expected_reason in cases.items():
            with self.subTest(text=text):
                self.assertEqual(rejection_reason(text), expected_reason)

    def test_keeps_valid_topics_and_medical_expressions(self) -> None:
        texts = (
            "孕期减少性生活",
            "乳房肿胀的疼痛可以通过冷敷",
            "心里十分着急于是报警求助",
            "我国封闭式基金的估值频率是",
            "我们报道了一位九旬老人",
            "这部电影里的对话很自然",
        )

        for text in texts:
            with self.subTest(text=text):
                self.assertIsNone(rejection_reason(text))

    def test_targeted_cleanup_keeps_normal_topics_and_removes_only_severe_items(self) -> None:
        payload = {
            "categories": {
                "现代文章朗读": {
                    "count": 4,
                    "items": [
                        {"id": "keep-medical", "text": "孕期减少性生活", "category": "现代文章朗读"},
                        {"id": "keep-finance", "text": "我国封闭式基金的估值频率是", "category": "现代文章朗读"},
                        {"id": "drop-ad", "text": "一键领取新人专享大礼包", "category": "现代文章朗读"},
                        {"id": "drop-asr", "text": "我们为为什么要用药呢", "category": "现代文章朗读"},
                    ],
                }
            }
        }

        cleaned, audit = clean_payload(payload)
        kept_ids = [item["id"] for item in cleaned["categories"]["现代文章朗读"]["items"]]
        self.assertEqual(kept_ids, ["keep-medical", "keep-finance"])
        self.assertEqual(audit["removed_count"], 2)
        self.assertEqual(
            set(audit["reason_counts"]),
            {"commercial_or_advertising", "asr_disfluency_or_duplication"},
        )
        self.assertTrue(set(audit["reason_counts"]).issubset(SEVERE_REJECTION_REASONS))

    def test_cleanup_audit_appends_new_confirmed_removals(self) -> None:
        previous = {
            "removed_items": [
                {"id": "old", "category": "现代文章朗读", "text": "旧污染句", "reason": "commercial_or_advertising"}
            ]
        }
        current = {
            "removed_items": [
                {"id": "new", "category": "会议与协作", "text": "新污染句", "reason": "asr_disfluency_or_duplication"}
            ],
            "policy": {"sentence_level_only": True},
        }

        merged = merge_audits(previous, current)
        self.assertEqual(merged["removed_count"], 2)
        self.assertEqual(merged["reason_counts"], {
            "asr_disfluency_or_duplication": 1,
            "commercial_or_advertising": 1,
        })


if __name__ == "__main__":
    unittest.main()
