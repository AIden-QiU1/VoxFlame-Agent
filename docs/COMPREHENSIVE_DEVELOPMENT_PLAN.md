# VoxFlame 全面开发计划 2026

> **脚踏实地，目光长远**
>
> 本文档基于代码现状全面评估，结合 2026 年最新技术，制定务实的开发路线图。

---

## 一、代码现状评估

### 1.1 Git 提交历史分析

```
e43846b - 登录功能完成 (2025-01-30)
9f68254 - security: remove exposed SSL private key
58f4872 - nginx + ssl
3b7dc4d - update
69cda00 - chore: cleanup ignored sub-projects
e33b68c - fix resolve issue
4d5d6dd - better agent
8758b77 - Initial commit
```

**分析**：项目经历约 2 个月开发，已完成 v1-v3 阶段，最近聚焦认证系统和安全加固。

### 1.2 代码规模统计

| 模块 | 文件数 | 代码行数（估计） | 质量 |
|------|--------|----------------|------|
| Frontend (TSX/TS) | 40 | ~3,500 | 良好 |
| Backend (TS) | 9 | ~1,500 | 可用 |
| TEN Extensions | 3 | ~1,200 | 良好 |
| **总计** | **52** | **~6,200** | **良好** |

### 1.3 功能完成度

| 功能模块 | 完成度 | 说明 |
|---------|--------|------|
| 用户认证 | 100% | Supabase Auth + JWT |
| WebSocket 连接 | 100% | Frontend → Backend → TEN |
| ASR 识别 | 90% | 阿里云 funasr-nano |
| LLM 纠错 | 80% | QWEN3 Max，prompt 待优化 |
| TTS 合成 | 90% | CosyVoice v3 |
| PWA 基础 | 70% | 可安装、Service Worker 部分实现 |
| 记忆系统 | 30% | 有 API 结构，未完整实现 |
| 常用短语 | 0% | 未实现 |
| 场景模板 | 0% | 未实现 |
| 双行字幕镜 | 0% | 未实现 |

---

## 二、技术栈深度评估

### 2.1 PWA 能力分析

**当前状态**：
- 已实现：manifest.json、usePWA Hook、组件（InstallPrompt、UpdatePrompt、OfflineNotice）
- 未实现：Service Worker 实际功能、IndexedDB 本地存储、离线模式核心功能

**PWA 上限评估**：PWA 完全满足当前需求，无需原生应用。

### 2.2 记忆系统评估

**VoxFlame 记忆系统方案**：

```
层 1: Supabase PostgreSQL (核心存储)
层 2: Qdrant 向量数据库 (语义检索)
层 3: IndexedDB (本地缓存)
层 4: Markdown 导出 (用户可读)
```

### 2.3 2026 中文模型评估

**Qwen3-ASR / Qwen3-TTS**：

| 模型 | 参数 | 优势 | 适用场景 |
|------|------|------|---------|
| Qwen3-ASR-1.7B | 1.7B | 52 种语言/方言，4.97% 错误率 | 生产环境首选 |
| Qwen3-TTS-1.7B | 1.7B | 3 秒声音克隆，情感控制 | 生产环境首选 |

**DeepSeek V3 / R1**：

| 指标 | QWEN3 Max | DeepSeek V3 | 决策 |
|------|-----------|-------------|------|
| 中文能力 | 优秀 | 优秀 | 均可 |
| 推理能力 | 良好 | 优秀 | DeepSeek 优 |
| API 成本 | 中等 | 更低 | DeepSeek |

**建议**：LLM 纠错层使用 DeepSeek V3（成本更低，能力更强）

---

## 三、全面开发路线图

### 阶段 1：核心功能完善 (2-4 周)

#### 1.1 双行字幕镜 (P0 - 3 天)
- Raw ASR + LLM 纠错 + 最终文本 三行对照
- 高亮不稳定的字/词
- 用户可点击纠错结果进行微调

#### 1.2 常用短语板 (P0 - 2 天)
- 短语 CRUD API
- TTS 预生成和缓存
- IndexedDB 本地缓存（离线可用）

#### 1.3 场景模板 (P0 - 2 天)
- 就医/购物/点餐/打车 预设短语
- 对话流程引导

### 阶段 2：PWA 能力完善 (1-2 周)

#### 2.1 Service Worker 实现
- 离线缓存策略
- TTS 音频永久缓存

#### 2.2 IndexedDB 本地存储
- 常用短语
- TTS 缓存
- 最近会话

### 阶段 3：记忆系统实现 (2-3 周)

#### 3.1 数据库设计
- user_profiles (用户画像)
- sessions (会话记录)
- memories (长期记忆)
- phrase_library (短语库)
- audio_records (音频记录)

#### 3.2 记忆 API 设计
- 存储记忆
- 语义搜索
- 用户画像提取
- 热词统计

### 阶段 4：高级功能 (3-4 周)

#### 4.1 感知差镜子
- Top-3 可能性展示
- 差异分析

#### 4.2 声音可视化
- 波形展示
- 梅尔频谱
- 与健康基准对比

### 阶段 5：模型升级 (2-3 周)

#### 5.1 ASR 升级到 Qwen3-ASR
- 本地部署选项
- 方言支持

#### 5.2 LLM 升级到 DeepSeek V3
- 更强的推理能力
- 更低的 API 成本

#### 5.3 TTS 升级到 Qwen3-TTS
- 3 秒声音克隆
- 情感控制

### 阶段 6：TEN 扩展开发 (2-3 周)

- memory_python (记忆扩展)
- phrase_manager_python (短语管理)
- tool_calling_python (工具调用)

---

## 四、自研框架评估

**当前策略**：TEN 仍有很大空间，暂不需自研。

**混合方案**：
- 核心路径：TEN Agent
- 本地加速：IndexedDB + 本地 ASR/TTS（可选）
- 高级功能：自研微服务（Memory、Phrase、Analytics）

---

## 五、优先级总结

### 立即执行（本周）
1. 双行字幕镜
2. 常用短语板
3. Qwen3-ASR 评估

### 短期（2-4 周）
4. 场景模板
5. PWA 完善
6. 记忆系统基础

### 中期（1-2 月）
7. 感知差镜子
8. 声音可视化
9. 模型升级

### 长期（3-6 月）
10. TEN 扩展
11. 声音教练
12. 生活代理

---

**让声音不仅被听见，更被理解。**
