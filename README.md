# VoxFlame Agent

**燃言 - Ignite Your Voice**

*专为2000万构音障碍者打造的AI语音助手*

---

## 重要提示 (非商业许可)

**本项目采用 CC BY-NC 4.0 许可证** - 禁止商业使用

详见 [LICENSE](LICENSE)

---

## 项目简介

**VoxFlame 燃言** 是一个为构音障碍患者打造的开源AI语音助手。通过热词增强、上下文记忆、个性化AI助手三大技术，让每个声音都被听见。

---

## 系统架构

| 模块 | 技术 | 端口 |
|------|------|------|
| 前端 | Next.js 14 + TypeScript + TailwindCSS + PWA | 3000 |
| 后端 | Express + TypeScript | 3001 |
| Agent | TEN Framework (Go Runtime + Python Extensions) | 8766 |
| ASR | 阿里云 Paraformer-realtime-v2 | - |
| LLM | QWEN3 Max via DashScope | - |
| TTS | CosyVoice v3 | - |

---

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+ (需要创建 venv 环境)
- Go 1.21+
- 阿里云 DashScope API Key

### 环境准备

```bash
# 1. 创建 Python 虚拟环境 (TEN Agent 需要)
python3 -m venv venv
source venv/bin/activate

# 2. 安装前后端依赖
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 3. 配置环境变量
# - ten_agent/.env      (DashScope API Key)
# - backend/.env        (Supabase 配置)
# - frontend/.env.local (前端配置)
```

---

## 启动服务

### 方式一: 一键启动 (推荐)

```bash
# 启动所有服务 (后台运行，日志输出到 logs 目录)
./start_services.sh

# 重启所有服务
./start_services.sh --restart

# 停止所有服务
./start_services.sh --stop

# 查看服务状态
./start_services.sh --status
```

日志文件:
- logs/ten_agent_*.log - TEN Agent
- logs/backend_*.log - 后端
- logs/frontend_*.log - 前端

### 方式二: 手动逐个启动 (调试用)

在三个独立的终端中分别执行:

**终端 1 - TEN Agent:**
```bash
./scripts/start_agent.sh
```

**终端 2 - 后端服务:**
```bash
./scripts/start_backend.sh
```

**终端 3 - 前端服务:**
```bash
./scripts/start_frontend.sh
```

**停止所有服务:**
```bash
./scripts/stop_services.sh
```

---

## TEN Agent 启动说明

TEN Agent 需要特定的环境配置，`ten_agent/scripts/start.sh` 已配置好:

```bash
# 激活 venv
source /root/VoxFlame-Agent/venv/bin/activate

# 设置 Python 库路径
export TEN_PYTHON_LIB_PATH=/usr/lib/x86_64-linux-gnu/libpython3.10.so.1.0

# 设置环境变量
export PYTHONPATH=$(pwd)/ten_packages/system/ten_ai_base/interface:$PYTHONPATH
export LD_LIBRARY_PATH=$(pwd)/ten_packages/system/ten_runtime_go/lib:...

# 启动
exec bin/main "$@"
```

---

## 访问地址

### 本地访问
- 前端: http://localhost:3000
- 后端: http://localhost:3001
- Agent WebSocket: ws://localhost:8766

### VSCode Remote SSH 用户

1. 打开 VSCode 端口面板: View -> Terminal -> Ports
2. 添加端口转发: 3000, 3001, 8766
3. 浏览器访问: http://localhost:3000

### SSH 手动端口转发

```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 -L 8766:localhost:8766 user@server
```

---

## 常见问题

### TEN Agent 启动失败: Failed to load libpython3.10.so

```bash
# 查找 Python 库位置
find /usr -name "libpython*.so*"

# 设置环境变量
export TEN_PYTHON_LIB_PATH=/usr/lib/x86_64-linux-gnu/libpython3.10.so.1.0
```

### venv 不存在

```bash
python3 -m venv /root/VoxFlame-Agent/venv
source /root/VoxFlame-Agent/venv/bin/activate
```

### 前端无法连接 Agent

1. 确认 TEN Agent 正在运行: `ss -tlnp | grep 8766`
2. 确认端口转发已配置 (VSCode 用户)

---

## License

**CC BY-NC 4.0** - 禁止商业用途

---

**让每个声音都被听见**

---

## 开发路线图

### 技术研究报告 (已完成)

为v2.0开发完成了全面的Voice Agent技术调研:

| 报告 | 内容 |
|------|------|
| 2025 ASR/TTS模型研究 | Alibaba FunAudio-ASR, ByteDance Doubao-ASR-2.0, NVIDIA Canary/Parakeet - 详见 docs/LATEST_ASR_TTS_MODELS_REPORT.md |
| TEN VAD 深度分析 | 语音活动检测、状态机、构音障碍场景适配 - 详见 docs/TEN_VAD_ANALYSIS.md |
| TEN Turn Detection 分析 | 轮次检测、Qwen2.5-7B语义分析 - 详见 docs/TEN_TURN_DETECTION_ANALYSIS.md |
| TEN 扩展生态分析 | message_collector, glue, webhook等核心扩展 - 详见 docs/TEN_EXTENSIONS_ANALYSIS.md |

关键发现:
- 2025 Voice Agent趋势: 端到端S2S模型 (Moshi 200ms延迟)、全双工对话
- 开源模型推荐: Fun-ASR-Nano (0.8B, N-best支持, 可微调)
- 构音障碍优化: VAD阈值降至0.3-0.4, 静默时间延长至1500-2000ms

---

### v2.0 - LLM 语音纠错功能 (开发中)

目标: 为构音障碍患者提供实时语音纠错功能

核心流程: 用户说话 -> ASR识别 -> LLM纠错 -> 清晰文字 + 正常语音

基于最新研究: Bridging ASR and LLMs for Dysarthric Speech (Interspeech 2025) - WER 从 0.38 降至 0.21

#### 开发阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 0 | 技术调研 | 完成 |
| Phase 1 | 基础LLM纠错扩展 (dysarthric_correction) | 待开始 |
| Phase 2 | VAD/Turn Detection优化 | 计划中 |
| Phase 3 | 个性化纠错 (用户词库、记忆) | 计划中 |
| Phase 4 | N-best重排序 (可选升级Fun-ASR-Nano) | 可选 |

详细计划: docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md

#### 核心架构

数据流: 麦克风 -> TEN VAD -> 阿里云ASR -> dysarthric_correction扩展 -> Qwen3-max纠错 -> 实时字幕 + LLM对话 + TTS

dysarthric_correction扩展职责:
1. 接收ASR文本 (is_final=true)
2. 结合用户词库和对话历史调用LLM纠错
3. 输出纠正后的文本给LLM和TTS

---

### 已完成功能 (v1.0)

- TEN Framework 语音助手基础架构
- 阿里云 Paraformer 实时语音识别
- 通义千问 LLM 对话
- CosyVoice TTS 语音合成
- WebSocket 实时通信
- PWA 支持
- 完整技术调研报告

---

## 技术文档

研究报告:
- docs/LATEST_ASR_TTS_MODELS_REPORT.md - 2025年最新ASR/TTS模型研究
- docs/TEN_VAD_ANALYSIS.md - TEN VAD深度分析
- docs/TEN_TURN_DETECTION_ANALYSIS.md - TEN Turn Detection分析
- docs/TEN_EXTENSIONS_ANALYSIS.md - TEN核心扩展生态分析

开发文档:
- docs/LLM_CORRECTION_DEVELOPMENT_PLAN.md - LLM纠错扩展开发计划
- docs/API_SPECIFICATION.md - API规范

---

## 参考资料
### 论文
- [Bridging ASR and LLMs for Dysarthric Speech Recognition](https://arxiv.org/abs/2508.08027) - Interspeech 2025
- [Zero-shot MLLM for Dysarthric ASR](https://arxiv.org/abs/2406.00639) - Interspeech 2024
- [Generative Error Correction with LLMs](https://arxiv.org/abs/2409.09554) - 2024

### 相关项目
- [CLEAR-VOX-MODEL](https://github.com/AIden-QiU1/CLEAR-VOX-MODEL) - 构音障碍语音研究
- [TEN-Agent](https://github.com/TEN-framework/TEN-Agent) - 实时语音 Agent 框架
