import json
from typing import Any

from openai import AsyncOpenAI
from ten_runtime.async_ten_env import AsyncTenEnv


class TrainingFeedbackGenerator:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        max_tokens: int,
        temperature: float,
        system_prompt: str,
        ten_env: AsyncTenEnv,
    ) -> None:
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.system_prompt = system_prompt
        self.ten_env = ten_env
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    def build_prompt(self, payload: dict[str, Any]) -> str:
        training_profile = payload.get("training_guidance_profile", {})
        training_profile_json = (
            json.dumps(training_profile, ensure_ascii=False)
            if isinstance(training_profile, dict)
            else "{}"
        )
        training_plan = payload.get("training_guidance_plan", [])
        training_plan_text = (
            "；".join(str(item).strip() for item in training_plan[:3] if str(item).strip())
            if isinstance(training_plan, list)
            else ""
        )
        return (
            "请根据下面信息生成训练反馈。\n"
            f"目标句：{payload.get('exercise_text', '')}\n"
            f"识别结果：{payload.get('recognized_text', '') or '系统未稳定听清'}\n"
            f"状态：{payload.get('feedback_status', 'unclear')}\n"
            f"类别：{payload.get('exercise_category', '')}\n"
            f"训练背景：{training_profile_json}\n"
            f"建议优先方向：{payload.get('training_guidance_focus', '') or '未指定'}\n"
            f"依据摘要：{payload.get('training_guidance_evidence', '') or '未指定'}\n"
            f"建议优先步骤：{training_plan_text or '未指定'}\n"
            f"漏掉的字：{'、'.join(payload.get('missing_chars', [])[:4]) or '无'}\n"
            f"多出的字：{'、'.join(payload.get('extra_chars', [])[:4]) or '无'}\n"
            f"重点音节：{'、'.join(payload.get('focus_syllables', [])[:4]) or '无'}\n"
            f"最容易混的发音：{'、'.join(payload.get('pronunciation_targets', [])[:3]) or '无'}\n"
            f"已有发音摘要：{payload.get('pronunciation_summary', '') or '无'}\n"
            f"候选动作提示：{'；'.join(payload.get('articulation_tips', [])[:3]) or '无'}\n\n"
            "要求：\n"
            "1. 只给真实用户能马上执行的建议，不要写开发者说明或医学诊断。\n"
            "2. 优先输出 2 到 3 步、每步都很短，先鼓励，再指出一个最关键重点。\n"
            "3. 如果训练背景显示程度较重，要更保守，只抓一个点并建议短句练习。\n"
            "4. 拼音只保留最关键的一处，没有必要时留空。\n\n"
            "严格输出 JSON："
            "{"
            "\"encouragement\":\"一句鼓励\","
            "\"summary\":\"一句总评\","
            "\"primary_focus\":\"最该先盯的一处\","
            "\"primary_pinyin\":\"最关键的一处拼音，没有就填空字符串\","
            "\"articulation_tip\":\"一条动作建议\","
            "\"next_step\":\"下一步怎么练\""
            "}"
        )

    async def generate(self, payload: dict[str, Any]) -> dict[str, str]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": self.build_prompt(payload)},
            ],
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            stream=False,
        )
        content = (response.choices[0].message.content or "").strip()
        return self._parse_json(content)

    def _parse_json(self, content: str) -> dict[str, str]:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = cleaned.replace("json", "", 1).strip()

        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict):
            raise ValueError("training feedback response is not a JSON object")

        return {
            "encouragement": str(parsed.get("encouragement", "") or "").strip(),
            "summary": str(parsed.get("summary", "") or "").strip(),
            "primary_focus": str(parsed.get("primary_focus", "") or "").strip(),
            "primary_pinyin": str(parsed.get("primary_pinyin", "") or "").strip(),
            "articulation_tip": str(parsed.get("articulation_tip", "") or "").strip(),
            "next_step": str(parsed.get("next_step", "") or "").strip(),
        }
