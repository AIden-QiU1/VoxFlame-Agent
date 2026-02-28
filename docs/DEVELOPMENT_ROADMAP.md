# VoxFlame 开发路线图 2026

> **Vibe Coding 时代**：代码可以更快，重要的是问题、方向和品味。
>
> **核心问题**：让构音障碍者真正"看见"自己的声音，解决认知差异带来的沟通障碍。
>
> **产品方向**：Agentic Voice = 能沟通 + 能变好 + 长期陪伴。
>
> **技术品味**：优雅的架构、隐私优先、温暖的设计。

---

## 一、核心问题定义

### 1.1 用户痛点：认知差异

构音障碍患者面临的核心问题：

> **患者主观感受**：我觉得我说得很清楚
> **他人客观接收**：听到的是完全不同的声音

这种**认知差异**导致：
- 患者不知道自己哪里说得不清楚
- 无法自我纠正
- 产生挫败感和社交焦虑
- 逐渐减少交流，陷入孤立

### 1.2 解决方案：感知差镜子

```
┌─────────────────────────────────────────────────────────────────┐
│                     "感知差镜子" 核心交互                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   用户说: "我...我...我...想...喝...水"                           │
│        ↓                                                         │
│   ┌─────────────────────────────────────────────────────┐       │
│   │  A. 原始录音 (患者听到的)                            │       │
│   │  [▶ 播放]  "我我我想喝水"                            │       │
│   └─────────────────────────────────────────────────────┘       │
│        ↓                                                         │
│   ┌─────────────────────────────────────────────────────┐       │
│   │  B. Raw ASR (陌生人可能听到的)                       │       │
│   │  "厄...厄...饿...睡"  ❌ 高亮不稳定的字              │       │
│   └─────────────────────────────────────────────────────┘       │
│        ↓                                                         │
│   ┌─────────────────────────────────────────────────────┐       │
│   │  C. LLM 纠错 (你真正想说的)                          │       │
│   │  "我想喝水"  ✅ 可点选/微调                          │       │
│   └─────────────────────────────────────────────────────┘       │
│        ↓                                                         │
│   ┌─────────────────────────────────────────────────────┐       │
│   │  D. 一键代播 / 全屏字幕                              │       │
│   │  [▶ 播放清晰语音]  [📺 全屏显示给对方]              │       │
│   └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、产品架构设计

### 2.1 五层能力模型

```
┌─────────────────────────────────────────────────────────────────┐
│                      VoxFlame Agentic Voice                        │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   输入层       │   │   处理层       │   │   输出层       │
│               │   │               │   │               │
│ • 语音输入     │   │ • ASR识别      │   │ • 清晰语音     │
│ • 文字输入     │   │ • LLM纠错      │   │ • 字幕显示     │
│ • 点击短语     │   │ • 意图理解     │   │ • 全屏对外     │
│ • 手势/眼动    │   │ • 记忆检索     │   │ • 通话中继     │
└───────────────┘   └───────────────┘   └───────────────┘
                              │
                    ┌─────────┴─────────┐
                    ↓                   ↓
            ┌───────────────┐   ┌───────────────┐
            │   记忆层       │   │   工具层       │
            │               │   │               │
            │ • 短期上下文   │   │ • 场景模板     │
            │ • 用户画像     │   │ • 设备控制     │
            │ • 发音特点     │   │ • 电话代理     │
            │ • 康复进度     │   │ • 社媒生成     │
            └───────────────┘   └───────────────┘
```

### 2.2 目标架构：Voice Gateway

参考 OpenClaw 的 Gateway 架构：

```
┌─────────────────────────────────────────────────────────────────┐
│                    VoxFlame Voice Gateway                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Gateway Server                          │   │
│  │  - WebSocket Server (统一入口)                           │   │
│  │  - Session Manager (会话管理)                            │   │
│  │  - Message Router (消息路由)                             │   │
│  │  - Tool Orchestrator (工具编排)                           │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  Channels (多端接入)                                            │
│  ├── web-channel      : Web/PWA 前端                           │
│  ├── family-channel   : 家属端 APP                             │
│  ├── phone-channel    : 电话端 (未来)                          │
│  └── device-channel   : 智能家居/设备                          │
│                                                                  │
│  Tools (能力模块)                                                │
│  ├── asr-tool         : 语音识别 (FunASR/OpenAI)               │
│  ├── tts-tool         : 语音合成 (CosyVoice/Qwen)              │
│  ├── llm-tool         : 意图理解与纠错 (DeepSeek/Anthropic)   │
│  ├── memory-tool      : 记忆检索 (Markdown + SQLite + Vectors)│
│  ├── correction-tool  : 构音障碍专用纠错                        │
│  ├── phone-tool       : 电话代理                                │
│  └── device-tool      : 阿里生态设备控制                        │
│                                                                  │
│  Memory (记忆系统)                                                │
│  ├── working-memory   : 当前对话上下文                          │
│  ├── episodic-memory  : 会话历史 (SQLite + Vectors)            │
│  └── persistent-memory: 用户画像 (Markdown 文件)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、开发阶段规划

### 阶段 1：沟通桥（MVP）

**目标**：让用户真的能用，能跟别人交流

#### 1.1 双行字幕镜

```typescript
interface SubtitleMirror {
  // A. 原始 ASR（别人第一次听到的）
  rawASR: {
    text: string
    confidence: number
    unstableWords: string[]  // 不稳定的字/词
  }

  // B. LLM 纠错（理解后的意图）
  corrected: {
    text: string
    alternatives: string[]  // 多个可能的理解
  }

  // C. 用户确认（最终表达）
  final: {
    text: string
    confirmed: boolean
  }
}
```

#### 1.2 常用短语板

```typescript
interface QuickPhrase {
  id: string
  text: string
  category: 'greeting' | 'need' | 'emotion' | 'medical' | 'custom'
  usageCount: number
  lastUsed: Date
  ttsCached?: ArrayBuffer  // 预生成的音频
}

// 预设短语
const PRESET_PHRASES = {
  greeting: ['你好', '谢谢', '再见', '对不起'],
  need: ['我需要帮助', '我饿了', '我渴了', '我累了', '我想休息'],
  emotion: ['我很开心', '我有点难过', '我不舒服'],
  medical: ['我需要挂号', '我哪里不舒服', '我要拿药', '我有医保卡']
}
```

#### 1.3 场景模板

```typescript
interface ScenarioTemplate {
  id: string
  name: string
  icon: string
  phrases: Array<{
    text: string
    context?: string  // 使用说明
  }>
}

// 预设场景
const SCENARIOS: ScenarioTemplate[] = [
  {
    id: 'medical',
    name: '就医问诊',
    icon: '🏥',
    phrases: [
      { text: '我需要挂号', context: '在医院入口处' },
      { text: '我哪里不舒服', context: '描述症状时' },
      { text: '我有医保卡', context: '缴费时' }
    ]
  },
  // ... 购物、点餐、打车等
]
```

---

### 阶段 2：感知差镜子

**目标**：让用户第一次"看见"自己的声音

#### 2.1 Listener Simulation

```typescript
// 模拟陌生人听到什么
interface ListenerSimulation {
  // Top-3 可能被听成的句子
  possibilities: Array<{
    text: string
    confidence: number
    strategy: 'weak-context' | 'strong-context'
  }>

  // 差异分析
  diff: {
    original: string      // 用户说的
    perceived: string     // 可能被听成的
    mismatchWords: string[]  // 不匹配的字
  }
}

// 实现策略
// 1. Weak Context: 模拟陌生人第一次听（无上下文）
// 2. Strong Context: 模拟熟人/有上下文的情况
```

#### 2.2 伙伴模式

```typescript
// 对方设备上显示
interface PartnerMode {
  userMessage: {
    text: string  // "TA 想说的是：____"
    rawAudio?: ArrayBuffer
  }

  actions: {
    understood: boolean  // "我懂了 ✅"
    needClarify: boolean  // "我没懂 ❓"
  }

  // 当点"没懂"时的自动修复
  repairOptions: Array<{
    strategy: 'rephrase' | 'keywords' | 'tts'
    content: string
  }>
}
```

#### 2.3 波形可视化

```typescript
interface VoiceVisualization {
  // 时间轴波形
  waveform: {
    data: number[]  // 振幅数据
    markers: Array<{
      start: number
      end: number
      label: 'unstable' | 'clear' | 'pause'
    }>
  }

  // 梅尔频谱（可选）
  spectrogram?: {
    data: number[][]  // 频率-时间矩阵
    heatmap: boolean  // 是否显示热力图
  }

  // 与健康基准对比
  comparison?: {
    user: number[]     // 用户波形
    healthy: number[]  // 健康基准
    diff: number[]     // 差异高亮
  }
}
```

---

### 阶段 3：声音教练

**目标**：把训练做成"能迁移"的技能

#### 3.1 节拍/键盘声控语速

```typescript
interface PacingTraining {
  // 节拍设置
  tempo: {
    bpm: number        // 每分钟节拍数
    sound: 'metronome' | 'keyboard' | 'custom'
    audioFile?: string
  }

  // 训练内容
  exercise: {
    text: string
    targetTempo: number
    allowedPause: number  // 允许的停顿时长
  }

  // 实时反馈
  feedback: {
    currentTempo: number
    isOnBeat: boolean
    suggestions: string[]
  }
}
```

#### 3.2 游戏化训练

```typescript
interface GamifiedTraining {
  // 每日微任务
  dailyTask: {
    id: string
    title: string
    description: string
    duration: number  // 分钟
    exercises: TrainingExercise[]
  }

  // 进度追踪
  progress: {
    streak: number      // 连续天数
    totalMinutes: number
    level: number
    xp: number
  }

  // 趋势分析
  trends: {
    clarityScore: number[]  // 清晰度趋势
    fluencyScore: number[]  // 流利度趋势
    date: Date[]
  }
}
```

---

### 阶段 4：生活代理

**目标**：场景按钮 + 确认式执行

#### 4.1 陌生人开口模板

```typescript
interface ConversationStarter {
  scenario: 'directions' | 'ordering' | 'shopping' | 'social'

  // 开场白
  openers: Array<{
    text: string
    tts: string  // 优化后的播报文本
  }>

  // 逐句接力
  turnByTurn: boolean  // 是否逐句辅助

  // 自动生成
  autoGenerate: (context: string) => ConversationStarter
}
```

#### 4.2 电话代理

```typescript
interface PhoneProxy {
  mode: 'script' | 'relay' | 'full-proxy'

  // Script 模式：通话前生成脚本
  script?: {
    outline: string[]  // 要点
    possibleQuestions: string[]  // 可能被问的问题
    responses: Map<string, string>  // 建议回答
  }

  // Relay 模式：实时字幕 + 一键代说
  relay?: {
    incomingText: string  // 对方的话转文字
    suggestions: string[]  // 建议回复
    ttsOut: boolean  // TTS 播报给对方
  }

  // 安全确认
  confirmationRequired: boolean
}
```

#### 4.3 智能家居（阿里生态）

```typescript
interface DeviceControl {
  // 确认式执行
  confirmAndExecute: {
    intent: string  // "开灯"
    parsed: {
      device: string
      action: string
      params: Record<string, any>
    }
    confirmMessage: string  // "将执行「客厅灯→打开」"
  }

  // AliGenie 集成
  aliGenie: {
    accessToken: string
    devices: Device[]
    scenes: Scene[]
  }
}
```

---

### 阶段 5：OpenClaw 式长期运行

**目标**：Gateway + Heartbeat + Durable Memory

#### 5.1 Voice Gateway

```typescript
class VoiceGateway {
  // 会话管理
  sessions: Map<string, Session>

  // 消息路由
  async route(message: Message, session: Session): Promise<Response>

  // 工具编排
  tools: Map<string, Tool>
  async orchestrate(intent: Intent): Promise<Result>
}

// 插件系统
interface Plugin {
  id: string
  type: 'channel' | 'tool' | 'memory'
  manifest: PluginManifest
  load(): Promise<void>
  unload(): Promise<void>
}
```

#### 5.2 Markdown 记忆

```
~/.voxflame/
├── MEMORY.md              # 用户画像 + 长期记忆
├── memory/
│   ├── 2026-02-28.md     # 每日日志
│   └── ...
└── memory.db             # SQLite + Vectors
```

```markdown
# MEMORY.md

## 用户画像

- 姓名：张三
- 障碍类型：痉挛型构音障碍
- 发音特点：舌尖音不清、语速快、停顿少

## 常用词汇

- 喝水 (高频)
- 帮忙 (每日)
- 谢谢 (每日)

## 康复进度

- 2026-02-01：清晰度评分 45
- 2026-02-15：清晰度评分 52 (+7)
- 2026-02-28：清晰度评分 58 (+6)

## 沟通偏好

- 喜欢直接表达，不喜欢绕弯子
- 需要对方耐心等待
- 用手势辅助表达
```

#### 5.3 心跳任务

```typescript
interface HeartbeatTask {
  // 每天
  daily: [
    '提醒练习：今日未完成',
    '生成每日训练任务',
    '总结昨日对话',
  ]

  // 每周
  weekly: [
    '生成康复进度报告',
    '更新用户画像',
    '优化常用短语',
  ]

  // 每月
  monthly: [
    '深度分析发音趋势',
    '调整训练难度',
    '导出康复报告',
  ]
}
```

---

## 四、技术选型与迁移

### 4.1 当前 → 目标

| 模块 | 当前 | 迁移路径 | 目标 |
|------|------|---------|------|
| 前端 | Next.js 14 | 保留 | 保留 |
| 实时通信 | WebSocket | → OpenAI Realtime API | S2S 端到端 |
| 后端 | Express Proxy | → Gateway 架构 | 自研框架 |
| Agent框架 | TEN | 先固定API，再逐步替代 | VoxFlame Core |
| ASR | 阿里云 | + FunASR 本地 | 混合模式 |
| LLM | QWEN3 | + DeepSeek V3 | Agentic Workflow |
| TTS | CosyVoice | + Voice Cloning | 个性化音色 |
| 记忆 | 无 | → OpenClaw 模式 | Markdown + SQLite |

### 4.2 TEN 替代策略

```
阶段 A (0-3个月): 保留 TEN，固定 API
  - 定义统一的 VoiceAgent 接口
  - 把会话/记忆/工具调用移到 Backend
  - 减少与 TEN 的耦合

阶段 B (3-6个月): 自研 Pipeline
  - 实现 VoxFlame Voice-Agent Core v0
  - 前端可切换 TEN/自研模式
  - 灰度验证

阶段 C (6-12个月): 完全替代
  - WebRTC/SFU 决策点
  - 优化延迟与稳定性
```

---

## 五、参考项目分析

### 5.1 OpenClaw

**可借鉴**：
- ✅ Gateway 架构（统一入口）
- ✅ Markdown 记忆（可读性强）
- ✅ 插件系统（扩展性好）
- ✅ voice-call 扩展（电话场景）
- ✅ 工具调用模式

**需简化**：
- ⚠️ 记忆系统过于复杂
- ⚠️ 多语言支持（中文优先）
- ⚠️ 过多的 LLM Provider

### 5.2 QuQu (蛐蛐)

**可借鉴**：
- ✅ 本地 FunASR（隐私优先）
- ✅ 过滤口头禅
- ✅ 编程术语优化
- ✅ 全局快捷键

**可参考**：
- 离线优先架构
- 简洁的用户体验

### 5.3 OpenAI Realtime API

**核心优势**：
- ✅ 端到端语音到语音
- ✅ Function Calling 内置
- ✅ 超低延迟（<500ms）
- ✅ 简单的 API 设计

**适用场景**：
- 阶段 1-2：快速验证
- 阶段 3+：自建 + 混合模式

---

## 六、核心指标

### 6.1 产品指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 沟通成功率 | 对方一次听懂比例 | 用户自评 + 伙伴模式 |
| 清晰度评分 | CER/WER 相对下降 | 模型评估 |
| 使用留存 | W4 留存率 | DAU/WAU |
| 训练完成率 | 每日任务完成 | 游戏化统计 |

### 6.2 技术指标

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 字幕延迟 | P50 ≤1.2s | 端到端测速 |
| TTS 延迟 | ≤500ms | API 响应时间 |
| 可用率 | ≥99% | 服务监控 |
| 离线可用率 | 核心功能本地 | 功能矩阵 |

---

## 七、风险与应对

| 风险 | 应对 |
|------|------|
| TEN 依赖声网 | 分阶段替代，先固定 API |
| 数据隐私 | 本地优先 + 加密存储 |
| 用户不持续 | 游戏化 + 温暖 IP |
| 成本过高 | 本地模型 + 缓存策略 |

---

## 八、下一步行动

### 当前优先级

1. **常用短语板**（1-2天）
   - QuickPhrasePanel 组件
   - 本地存储 + 云端同步
   - TTS 预缓存

2. **场景模板**（1天）
   - 5 个核心场景
   - 场景切换 UI
   - 短语数据结构

3. **双行字幕镜**（2-3天）
   - 三行对照 UI
   - Listener Simulation
   - 用户确认流程

### 技术债务

1. 添加测试（当前 0% 覆盖）
2. 完善 TODO 项
3. 统一错误处理
4. 添加监控日志

---

**让声音不仅被听见，更被理解。**
