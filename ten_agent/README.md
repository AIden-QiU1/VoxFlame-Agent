# VoxFlame TEN Agent

VoxFlame 当前的 TEN runtime 已收口到 `RTC + RTM + Backend API` 单一路径；旧 websocket runtime 已从默认镜像、默认入口和仓库现役代码中移除。

## 当前运行态

- 当前 graph：`agora_rtc -> streamid_adapter -> voxflame_vad_python -> qwen_asr_realtime_python -> voxflame_main_python -> llm_correction_python -> qwen_tts_realtime_python`
- 当前职责：
  - `agora_rtc`：承接实时音频与最小 data stream 能力
  - `agora_rtm`：承接可靠文本 / 控制消息
  - `voxflame_vad_python`：服务端语音活动检测，驱动更早的 flush / finalize
  - `qwen_asr_realtime_python`：基于 DashScope realtime ASR 协议的现役 ASR
  - `llm_correction_python`：结合 `voice_profile` 做中文纠错
  - `qwen_tts_realtime_python`：基于 DashScope realtime TTS 协议的现役 TTS
  - `memory_layer_python`：会话、热词、混淆模式、clarity trend 持久化
- 当前状态：
  - 默认运行态只启动 TEN control server，由 backend `/api/rtc/session/*` 动态拉起 worker
  - 沟通页已验证 `RTC audio + RTM text/control` 主链
  - 训练页已恢复 RTC 会话能力，剩余重点是更完整的训练反馈与生命周期打磨

## 路径分类

- `current`
  - `ten_agent/property.json`
  - `ten_agent/extension_src/qwen_asr_realtime_python`
  - `ten_agent/extension_src/qwen_tts_realtime_python`
  - `ten_agent/extension_src/streamid_adapter`
  - `ten_agent/extension_src/voxflame_vad_python`
  - `ten_agent/extension_src/voxflame_main_python`
  - `ten_agent/extension_src/llm_correction_python`
  - `ten_agent/extension_src/memory_layer_python`
- `removed / retired`
  - 旧 websocket transport extension
  - `aliyun_asr_bigmodel_python`
  - `cosy_tts_python`
  - 任何继续绕开 backend `/api/rtc/session/*` 的直连 runtime

## 目录

```text
ten_agent/
├── extension_src/
│   ├── qwen_asr_realtime_python/
│   ├── qwen_tts_realtime_python/
│   ├── llm_correction_python/
│   ├── memory_layer_python/
│   ├── streamid_adapter/
│   ├── voxflame_main_python/
│   ├── voxflame_vad_python/
│   └── message_collector2/
├── manifest.json
├── property.json
├── Dockerfile
└── scripts/
```

## 当前配置入口

- Runtime graph: [property.json](/home/ubuntu/VoxFlame-Agent/ten_agent/property.json)
- 主控扩展: [extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/voxflame_main_python/extension.py)
- VAD 扩展: [extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/voxflame_vad_python/extension.py)
- Qwen ASR 扩展: [extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/qwen_asr_realtime_python/extension.py)
- Qwen TTS 扩展: [extension.py](/home/ubuntu/VoxFlame-Agent/ten_agent/extension_src/qwen_tts_realtime_python/extension.py)
- 当前产品主文档: [VOXFLAME_PRODUCT_PRD_2026-03-24.md](/home/ubuntu/VoxFlame-Agent/docs/VOXFLAME_PRODUCT_PRD_2026-03-24.md)
- 当前任务: [current.md](/home/ubuntu/VoxFlame-Agent/.tasks/current.md)

## 开发原则

- 不在 `aliyun_asr_bigmodel_python` / `cosy_tts_python` 上继续堆 `Qwen realtime` 临时兼容。
- 不再恢复 websocket runtime 或任何基于 base64 PCM over websocket 的影子主链。
- 生产主链固定为 `Frontend RTC/RTM -> Backend orchestration -> TEN RTC worker`，不接受“只改传输 URL”的伪迁移。

## 运行

```bash
sudo docker compose up -d --build ten-agent
sudo docker compose logs -f ten-agent
```

## Qwen ASR Live Smoke

不依赖浏览器麦克风，直接把仓库里的 16k 中文 PCM 样本送进运行中的 `ten-agent` 容器，验证 DashScope realtime ASR 的 `connect -> append -> commit -> final transcript`：

```bash
bash scripts/qwen_asr_live_smoke.sh
```

可选第二个参数用于断言最终转写里必须包含某段文本：

```bash
bash scripts/qwen_asr_live_smoke.sh \
  ten-framework/ai_agents/agents/integration_tests/asr_guarder/tests/test_data/16k_zh_cn.pcm \
  日程管理
```

## Qwen TTS Live Smoke

直接在运行中的 `ten-agent` 容器里调用现役 realtime TTS client，验证 `connect -> input_text_buffer.append -> commit -> response.audio.delta -> response.done`：

```bash
bash scripts/qwen_tts_live_smoke.sh
```

可选第一个参数传入自定义文本：

```bash
bash scripts/qwen_tts_live_smoke.sh "请给我一点时间，我正在努力说清楚。"
```

## 参考

- TEN 官方示例：
  - `ten-framework/ai_agents/agents/examples/voice-assistant-advanced`
  - `ten-framework/ai_agents/agents/examples/rtm-transport`
- 项目状态：
  - [current.md](/home/ubuntu/VoxFlame-Agent/.tasks/current.md)
  - [.claude-summary.md](/home/ubuntu/VoxFlame-Agent/.claude-summary.md)
