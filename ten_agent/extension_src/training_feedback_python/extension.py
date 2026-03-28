import json
from typing import Any

from ten_runtime import AsyncExtension, AsyncTenEnv, Cmd, CmdResult, Data, StatusCode

from .config import TrainingFeedbackConfig
from .feedback_generator import TrainingFeedbackGenerator


class TrainingFeedbackExtension(AsyncExtension):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.config: TrainingFeedbackConfig | None = None
        self.generator: TrainingFeedbackGenerator | None = None

    async def on_init(self, ten_env: AsyncTenEnv) -> None:
        config_json, _ = await ten_env.get_property_to_json("")
        self.config = TrainingFeedbackConfig.model_validate_json(config_json)
        self.config.validate_config()

    async def on_start(self, ten_env: AsyncTenEnv) -> None:
        assert self.config is not None
        self.generator = TrainingFeedbackGenerator(
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            model=self.config.model,
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
            system_prompt=self.config.system_prompt,
            ten_env=ten_env,
        )

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd) -> None:
        payload = self._load_json_from_cmd(cmd)

        if cmd.get_name() != "generate_training_feedback":
            await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))
            return

        response_payload = dict(payload)
        try:
            assert self.generator is not None
            response_payload.update(await self.generator.generate(payload))
            response_payload["source"] = "training_feedback_extension"
        except Exception as error:
            ten_env.log_error(f"[TrainingFeedback] generation failed: {error}")
            response_payload.update(self._build_fallback(payload))
            response_payload["source"] = "training_feedback_fallback"
            response_payload["error"] = str(error)

        data = Data.create("training_feedback_result")
        data.set_property_from_json(None, json.dumps(response_payload, ensure_ascii=False))
        await ten_env.send_data(data)
        await ten_env.return_result(CmdResult.create(StatusCode.OK, cmd))

    def _load_json_from_cmd(self, cmd: Cmd) -> dict[str, Any]:
        try:
            cmd_json, _ = cmd.get_property_to_json(None)
            payload = json.loads(cmd_json) if cmd_json else {}
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def _build_fallback(self, payload: dict[str, Any]) -> dict[str, str]:
        status = str(payload.get("feedback_status", "unclear") or "unclear")
        focus_syllables = payload.get("focus_syllables", [])
        pronunciation_targets = payload.get("pronunciation_targets", [])
        articulation_tips = payload.get("articulation_tips", [])
        missing_chars = payload.get("missing_chars", [])

        if isinstance(pronunciation_targets, list) and pronunciation_targets:
            primary_focus = str(pronunciation_targets[0]).strip()
        elif isinstance(focus_syllables, list) and focus_syllables:
            primary_focus = str(focus_syllables[0]).strip()
        elif isinstance(missing_chars, list) and missing_chars:
            primary_focus = f"先补“{missing_chars[0]}”"
        else:
            primary_focus = "先把整句放慢"

        encouragement = {
            "excellent": "这次已经说得很稳了。",
            "close": "这次已经很接近了。",
            "retry": "这次有进步，我们先只改一处。",
            "unclear": "这次系统没完全听清，但我们还能继续试。",
        }.get(status, "这次先抓最重要的一处继续练。")

        next_step = {
            "excellent": "保持这个节奏，再换一句常用的话。",
            "close": "先把这一处单独慢练两遍，再回整句。",
            "retry": "先拆成短一点的两段，再连回整句。",
            "unclear": "先换安静一点的环境，再慢一点录一遍。",
        }.get(status, "先慢一点，再录一遍。")

        articulation_tip = (
            str(articulation_tips[0]).strip()
            if isinstance(articulation_tips, list) and articulation_tips
            else "嘴巴动作先做大一点，把关键词拉开说。"
        )

        return {
            "encouragement": encouragement,
            "summary": f"这次先重点看：{primary_focus}。",
            "primary_focus": primary_focus,
            "primary_pinyin": "",
            "articulation_tip": articulation_tip,
            "next_step": next_step,
        }

