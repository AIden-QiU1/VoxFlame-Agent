# 🔥 燃言 VoxFlame Agent

<p align="center">
  <img src="docs/assets/voxflame-logo.svg" alt="VoxFlame Logo" width="200">
</p>

<h3 align="center">🎤 点燃你的声音 · Ignite Your Voice</h3>

<p align="center">
  <strong>为2000万构音障碍患者打造的AI超级助手</strong><br>
  <em>让每一个声音都被听见、被理解、被实现</em>
</p>

<p align="center">
  <a href="#愿景">愿景</a> •
  <a href="#核心功能">核心功能</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#开发计划">开发计划</a> •
  <a href="#架构设计">架构设计</a> •
  <a href="#研究成果">研究成果</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/中文名-燃言-orange?style=for-the-badge" alt="燃言">
  <img src="https://img.shields.io/badge/English-VoxFlame-blue?style=for-the-badge" alt="VoxFlame">
  <img src="https://img.shields.io/badge/Agent-AI超级助手-green?style=for-the-badge" alt="Agent">
</p>

---

## ��️ 品牌释义

| 中文 | 英文 | 含义 |
|------|------|------|
| **燃言** | **VoxFlame** | Vox(拉丁语:声音) + Flame(火焰) = 点燃声音 |

> **品牌故事**  
> 每一个构音障碍患者心中，都有想说却说不出的话。  
> 燃言，点燃你的声音，让世界听见你。

**中文口号**: 点燃你的声音  
**英文口号**: Ignite Your Voice

---

## 🌟 愿景

**市场规模**: 中国有 **2000万** 构音障碍患者（包括1200-1500万构音障碍+老年人群体）

**核心问题**:
- 62% 患者有抑郁倾向，68% 因沟通困难减少外出
- 普通ASR对构音障碍语音识别准确率 < 30%（WER > 70%）
- 紧急场景（呼救/医疗）无法表达，危及生命安全
- 日常沟通需要家人"翻译"，每天额外2-3小时负担

**VoxFlame的使命**:

> 不是"纠正"用户的发音，而是**理解**用户的意图。  
> 从"翻译机"到"超级助手"，覆盖家庭、电话、会议、AAC四大场景。

---

## ✨ 核心功能

### 🎯 四大超级助手场景

#### 1️⃣ 家庭面对面模式 (P0)
- 🎤 **高精度ASR**: Whisper-large-v3 + PB-DSR，WER从70%→30%以下
- 🔊 **清晰语音重建**: 患者语音→标准语音，TTS播放
- 📝 **实时大字幕**: 投屏到电视，家人一目了然
- 💬 **快捷短语**: 50+常用需求一键表达

#### 2️⃣ 电话实时助手 (P0)
- ☎️ **App内置VoIP**: 基于Twilio Voice.js，PWA中直接拨打真实电话
- 📞 **来电辅助**: 实时字幕+AI总结对方意图
- 🗣️ **拨打辅助**: 患者说话→清晰语音传输给对方
- 🚨 **一键呼救**: 长按3秒自动拨打家人/120

#### 3️⃣ 多人会议主持 (P1)
- 🎥 **Zoom SDK集成**: 嵌入式会议界面
- 👥 **说话人识别**: 自动标注"张三: xxx"
- 📊 **AI会议助手**: 每5分钟总结讨论要点
- ⚡ **快捷回复**: "同意/反对/稍等"一键发送

#### 4️⃣ AAC图片交流增强 (P1)
- 📸 **拍照生成符号板**: CLIP识别冰箱食物→自动生成"我想要牛奶"
- 🧠 **上下文感知**: 早餐时间自动推荐"牛奶/面包/鸡蛋"
- 🎨 **个性化符号**: Stable Diffusion生成用户专属符号
- 🕒 **场景自动切换**: Agent检测当前场景（家/医院/超市）

---

## 🚀 快速开始

### 环境要求
```
Node.js 18+
Python 3.10+
Redis 7.0+
PostgreSQL 14+ (Supabase)
```

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/your-org/voxflame-agent.git
cd voxflame-agent

# 2. 前端 (Next.js PWA)
cd frontend
npm install
cp .env.example .env.local
# 配置环境变量: NEXT_PUBLIC_API_URL, TWILIO_ACCOUNT_SID
npm run dev  # http://localhost:3000

# 3. 后端 (Express)
cd ../backend
npm install
cp .env.example .env
# 配置: DATABASE_URL, REDIS_URL, ASR_API_KEY
npm run dev  # http://localhost:3001

# 4. Agent SDK
cd ../agent-sdk
pip install -e .
python examples/asr_worker.py  # 启动ASR Worker

# 5. 启动Redis
docker run -d -p 6379:6379 redis:7-alpine
```

### Docker Compose（推荐）

```bash
docker-compose up -d
# 访问 http://localhost:3000
```

---

## 📅 开发计划

### 🎯 MVP阶段 (Month 1-3)

| Sprint | 功能 | 时长 | 状态 | KPI |
|--------|------|------|------|-----|
| Sprint 1 | 核心ASR基础 | 4周 | ✅ 50% | WER < 40% |
| Sprint 2 | PWA + 电话功能 | 4周 | 🔄 进行中 | 延迟 < 500ms |
| Sprint 3 | Agent智能体 | 4周 | ⏳ 待开始 | 意图准确率 > 85% |

### 🚀 V1.0阶段 (Month 4-6)

| Sprint | 功能 | 时长 | 状态 | KPI |
|--------|------|------|------|-----|
| Sprint 4 | 会议与AAC | 4周 | ⏳ | 10,000 MAU |
| Sprint 5 | 个性化与优化 | 4周 | ⏳ | 留存率 > 40% |
| Sprint 6 | 商业化准备 | 4周 | ⏳ | 付费转化 > 5% |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    VoxFlame Agent 架构                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│   │   前端 PWA   │     │   后端 API   │     │  AI Workers  │  │
│   │  Next.js 14 │◄───►│   Express   │◄───►│  Python SDK │  │
│   │  Twilio SDK │     │   WebSocket │     │  Whisper    │  │
│   │  Zoom SDK   │     │   Redis MQ  │     │  Qwen2.5    │  │
│   └─────────────┘     └─────────────┘     └─────────────┘  │
│                              │                              │
│                    ┌─────────▼─────────┐                   │
│                    │                   │                   │
│                    │   Supabase DB     │                   │
│                    │   + Redis Cache   │                   │
│                    │                   │                   │
│                    └───────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈一览

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 14, TypeScript, Tailwind CSS, PWA, Twilio Voice SDK |
| **后端** | Node.js, Express, WebSocket, Redis, PostgreSQL |
| **AI** | Whisper-large-v3, PB-DSR, Qwen2.5-Omni, CosyVoice |
| **部署** | Vercel, 阿里云ECS, Supabase, Docker |

---

## 📊 研究成果

### 完整研究报告

我们完成了 **33个章节** 的完整研究报告，覆盖：

| 部分 | 内容 | 章节数 |
|------|------|--------|
| **Part 1** | 技术调研 | 7 章 |
| **Part 2** | 科研大师视角 | 9 章 |
| **Part 3** | 产品经理视角 | 9 章 |
| **Part 4** | 超级助手实现 | 8+ 章 |

**📖 阅读完整报告**: [docs/my_research.md](docs/my_research.md)

### 核心技术指标

```
ASR准确率提升路线:
  基线 WER: 67%
  └─ + PB-DSR: 38% (-50%)
  └─ + LLM纠错: 35% (-7.36%)
  └─ + 个性化: 25% (目标)
```

---

## 🤝 参与贡献

### 开发者

```bash
# 安装开发依赖
pip install -e ./agent-sdk
pip install -r tests/requirements.txt

# 运行测试
pytest tests/ -v
```

### 研究者

- [技术调研报告 (33章节)](docs/my_research.md)
- [用户研究总结](docs/USER_RESEARCH_SUMMARY.md)
- [API规范](docs/API_SPECIFICATION.md)

### 志愿者

- 🎤 贡献语音数据
- 📝 翻译文档
- 💬 社区支持

---

## 📜 开源协议

MIT License

---

## 💬 联系我们

- GitHub Issues: [提交问题](https://github.com/your-org/voxflame-agent/issues)
- Email: 2307294809@qq.com

---

<p align="center">
  <img src="https://img.shields.io/badge/🔥-燃言-orange?style=for-the-badge" alt="燃言">
  <img src="https://img.shields.io/badge/VoxFlame-Agent-blue?style=for-the-badge" alt="VoxFlame Agent">
</p>

<p align="center">
  <strong>点燃你的声音 · Ignite Your Voice 🔥</strong><br>
  <em>让AI成为沟通的桥梁，而非障碍</em>
</p>

**⭐ Star 本项目支持构音障碍患者！**
