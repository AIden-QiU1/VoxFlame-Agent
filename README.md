# VoxFlame Agent

**燃言 · Ignite Your Voice**

*专为2000万构音障碍者打造的AI语音助手*

---

## 重要提示 (非商业许可)

**本项目采用 CC BY-NC 4.0 许可证**

- 禁止商业使用
- 仅限个人研究和非商业目的
- **违反许可将追究法律责任**
- 如有商业需求，请联系作者

详见 [LICENSE](LICENSE)

---

## 项目简介

**VoxFlame 燃言** 是一个为构音障碍患者打造的开源AI语音助手。

### 解决的问题

构音障碍患者因"言语含糊"长期被语音识别技术遗忘，无法正常使用语音助手。

- **识别难**: 普通ASR对构音障碍语音识别率 < 30%
- **交互难**: 常规语音助手无法理解患者意图
- **获取难**: 专业辅助设备价格昂贵，普通家庭难以承受

### 我们的方案

通过热词增强、上下文记忆、个性化AI助手三大技术，让每个声音都被听见。

### 目标人群

中国约2000万构音障碍患者及其家庭

---

## 系统架构 (V2.0 单Agent架构)

```
+-----------------------------------------------------------+
|                     用户设备(浏览器)                           |
+----------------------------+------------------------------+
                             |
        +--------------------+--------------------+
        |                    |                    |
        v                    v                    v
+---------------+    +---------------+    +---------------+
| 前端 (3000)   |    | TEN Agent     |    | 后端 (3001)   |
| Next.js       |    | (8765)        |    | Express       |
|               |    |               |    |               |
| - 语音采集 UI  |    | - ASR 识别    |    | - 用户配置    |
| - 实时波形    |--->| - LLM 对话    |    | - 记忆系统    |
| - 对话展示    |<---| - TTS 合成    |    | - 工具调用    |
+---------------+    +---------------+    +---------------+
                                               |
                                          +----+----+
                                          | 数据库  |
                                          | Supabase|
                                          +---------+
```

### 技术栈

| 模块 | 技术 | 端口 |
|------|------|------|
| 前端 | Next.js 14 + TypeScript + TailwindCSS + PWA | 3000 |
| 后端 | Express + TypeScript | 3001 |
| Agent | TEN Framework (Go Runtime + Python Extensions) | 8765 |
| ASR | 阿里云 Paraformer-realtime-v2 | - |
| LLM | QWEN3 Max via DashScope | - |
| TTS | CosyVoice v3 | - |
| 存储 | SQLite + FAISS + Supabase | - |

---

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+
- Go 1.21+
- 阿里云 DashScope API Key

### 一键启动

```bash
cd /root/VoxFlame-Agent
./start_services.sh
```

### 手动启动

```bash
# 1. 启动 TEN Agent
cd ten_agent && ./bin/main -property property.json &

# 2. 启动后端
cd backend && npm run dev &

# 3. 启动前端
cd frontend && npm run dev &
```

### 访问地址

- 本地访问: http://localhost:3000
- 局域网访问: http://YOUR_IP:3000 (需开放 3000/3001/8765 端口)

---

## 开发路线图 (Roadmap)

### Phase 1: MVP 核心功能 (已完成)

- [x] 语音识别 (ASR)
- [x] LLM 对话 (QWEN3)
- [x] 语音合成 (CosyVoice)
- [x] 基础对话 UI
- [x] 单一 Agent 架构
- [x] 多客户端 WebSocket 支持

### Phase 2: 增强功能 (进行中)

- [ ] 热词增强 (Hotwords) - 提高专业词汇识别率
- [ ] 记忆系统 (Memory) - 个性化对话体验
- [ ] 工具调用 (Tools) - 扩展Agent能力
- [ ] text_webhook - 文字输入备选方案

### Phase 3: 核心技术 (规划中)

- [ ] WavRAG - 基于原始音频的检索增强
- [ ] 语音克隆 - 个性化合成音色
- [ ] 多模态识别 - 图片/手势 fallback
- [ ] 离线模式支持

### Phase 4: 规模化 (远期)

- [ ] Agora RTC 集成 - 更稳定的实时通信
- [ ] Kubernetes 部署 - 云原生弹性扩展
- [ ] 移动端 App

---

## PWA 渐进式Web应用 开发进度

VoxFlame 采用 PWA 技术，提供类原生应用体验。

### 已实现功能

| 功能 | 状态 | 说明 |
|------|------|------|
| Web App Manifest | 已完成 | 完整的应用清单配置 |
| Service Worker | 已完成 | 基于 Workbox 的缓存策略 |
| 多尺寸图标 | 已完成 | 192x192, 512x512 及各种Apple图标 |
| Maskable 图标 | 已完成 | 自适应图标支持 |
| 应用快捷方式 | 已完成 | "开始录音"、"贡献声音" |
| 离线缓存 | 已完成 | 静态资源、字体、图片缓存 |
| 添加到主屏幕 | 已完成 | standalone 显示模式 |

### 待开发功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 推送通知 (Push) | P1 | 用于提醒用户、健康检查通知 |
| 后台同步 (Background Sync) | P1 | 断网时缓存对话，恢复后自动同步 |
| 离线语音识别 | P2 | 本地ASR模型，无网络时可用 |
| 文件处理器 (File Handler) | P2 | 处理音频文件分享 |
| 分享目标 (Share Target) | P2 | 接收其他应用分享的内容 |
| 截图美化 | P3 | 完善应用商店展示截图 |
| Widget 支持 | P3 | Windows/macOS 桌面小组件 |
| 协议处理器 (Protocol Handler) | P3 | 自定义 voxflame:// 协议 |

### PWA 技术规范参考

基于 [PWABuilder](https://github.com/pwa-builder/pwabuilder) 官方文档:

1. **推送通知实现**
   - 注册 Service Worker push 事件监听
   - 使用 Web Push API 发送通知
   - 支持自定义图标和操作按钮

2. **后台同步实现**
   - 使用 Background Sync API
   - 离线时缓存用户输入
   - 网络恢复后自动发送

3. **分享目标配置**
   - manifest.json 添加 share_target 配置
   - 支持接收文本、URL、文件

---

## 文档目录

- [产品需求文档 (PRD)](docs/PRD.md)
- [系统架构设计](docs/ARCHITECTURE.md)
- [API 规范](docs/API_SPECIFICATION.md)
- [Agent 开发指南](docs/agent.md)
- [技术研究文档](docs/VoxFlame_Complete.md)
- [用户调研报告](docs/USER_RESEARCH_DYSARTHRIC_ELDERLY_CN.md)

---

## 贡献指南

欢迎提交 Issue 和 Pull Request

---

## License

本项目采用 **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** 许可证。

**禁止任何商业用途**

详见 [LICENSE](LICENSE)

---

## 致谢

- [TEN Framework](https://github.com/TEN-framework/TEN-framework) - 实时 Agent 框架
- [阿里云 DashScope](https://dashscope.aliyun.com/) - ASR/LLM/TTS 服务
- [Supabase](https://supabase.com/) - 数据库服务
- [PWABuilder](https://pwabuilder.com/) - PWA 开发指南

---

**让每个声音都被听见**
