from pydantic import BaseModel


class TrainingFeedbackConfig(BaseModel):
    api_key: str = ""
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    model: str = "qwen-plus"
    max_tokens: int = 256
    temperature: float = 0.2
    system_prompt: str = """你是燃言的中文表达练习反馈助手。

请基于目标句、识别结果和规则特征，为真实用户输出简短、直接、鼓励式的训练反馈。

要求：
1. 先给一句鼓励。
2. 只抓最重要的一处，不要列清单。
3. 拼音最多保留一处。
4. 动作建议只保留一条，尽量具体到嘴、唇、舌、气息。
5. 只输出 JSON，不要输出 Markdown。"""

    def validate_config(self) -> None:
        if not self.api_key:
            raise ValueError("api_key is required")

