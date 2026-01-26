# VoxFlame 技术文档导航

> 本目录包含项目的技术调研、开发计划和实施指南。

---

## 📚 文档分类

### 🎯 TEN Framework 相关

核心框架分析，了解 TEN 的架构和扩展机制。

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [TEN Framework 分析](TEN_FRAMEWORK_ANALYSIS.md) | TEN 架构概览 | ⭐⭐⭐ |
| [TEN 扩展分析](TEN_EXTENSIONS_ANALYSIS.md) | 扩展生态系统深度分析 | ⭐⭐⭐ |
| [TEN VAD 分析](TEN_VAD_ANALYSIS.md) | 语音活动检测参数研究 | ⭐⭐ |
| [TEN Turn Detection 分析](TEN_TURN_DETECTION_ANALYSIS.md) | 对话轮次检测机制 | ⭐⭐ |

**适用场景**：
- 开发 TEN 扩展时
- 调试 Agent 问题时
- 优化 VAD/Turn Detection 参数时

---

### 🧠 Memory & RAG 系统

记忆系统和检索增强生成相关研究。

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [Memory RAG 系统研究](MEMORY_RAG_SYSTEMS_RESEARCH.md) | RAG 技术调研 | ⭐⭐⭐ |
| [Memory 系统计划](MEMORY_SYSTEM_PLAN.md) | 记忆系统实施方案 | ⭐⭐ |

**适用场景**：
- 实现上下文记忆时
- 集成向量数据库（Qdrant）时
- 设计个性化纠错时

---

### 🎤 语音技术调研

ASR/TTS 模型和构音障碍相关研究。

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [ASR/TTS 模型报告](LATEST_ASR_TTS_MODELS_REPORT.md) | 最新语音模型对比 | ⭐⭐⭐ |
| [LLM 纠错开发计划](LLM_CORRECTION_DEVELOPMENT_PLAN.md) | v2.0 纠错扩展实施方案 | ⭐⭐⭐ |
| [用户研究：构音障碍老年群体](USER_RESEARCH_DYSARTHRIC_ELDERLY_CN.md) | 用户需求洞察 | ⭐⭐ |

**适用场景**：
- 优化语音识别准确率时
- 调整 LLM 纠错 Prompt 时
- 理解用户需求时

---

### 🌐 前端与通信

前端开发和实时通信相关文档。

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [PWA 实施指南](PWA_IMPLEMENTATION_GUIDE.md) | PWA 离线策略 | ⭐⭐ |
| [WebSocket vs RTC 指南](WEBSOCKET_VS_RTC_GUIDE.md) | 实时通信协议对比 | ⭐⭐ |
| [API 规范](API_SPECIFICATION.md) | 后端 API 文档 | ⭐⭐ |

**适用场景**：
- 开发前端功能时
- 优化 WebSocket 通信时
- 评估 RTC 迁移时

---

### 📦 部署与运维

部署、运维和数据库相关文档。

| 文档 | 描述 | 优先级 |
|------|------|--------|
| [部署指南](DEPLOYMENT_GUIDE.md) | Docker 部署流程 | ⭐⭐⭐ |
| [数据库设计](database/) | 数据库 schema | ⭐ |

**适用场景**：
- 部署到生产环境时
- 配置 Nginx/SSL 时
- 数据库迁移时

---

### 📄 项目文档

项目概述和通用文档。

| 文档 | 描述 |
|------|------|
| [VoxFlame 概述](VoxFlame.md) | 项目愿景和架构 |

---

## 🔍 快速查找

### 按任务类型查找

**开发 TEN 扩展**：
1. [TEN Framework 分析](TEN_FRAMEWORK_ANALYSIS.md) - 了解架构
2. [TEN 扩展分析](TEN_EXTENSIONS_ANALYSIS.md) - 查看示例
3. [LLM 纠错开发计划](LLM_CORRECTION_DEVELOPMENT_PLAN.md) - 具体实现

**优化语音识别**：
1. [ASR/TTS 模型报告](LATEST_ASR_TTS_MODELS_REPORT.md) - 模型选择
2. [TEN VAD 分析](TEN_VAD_ANALYSIS.md) - 参数调整
3. [用户研究](USER_RESEARCH_DYSARTHRIC_ELDERLY_CN.md) - 理解用户

**实现记忆系统**：
1. [Memory RAG 系统研究](MEMORY_RAG_SYSTEMS_RESEARCH.md) - 技术调研
2. [Memory 系统计划](MEMORY_SYSTEM_PLAN.md) - 实施方案
3. [数据库设计](database/) - 数据表设计

**前端开发**：
1. [PWA 实施指南](PWA_IMPLEMENTATION_GUIDE.md) - 离线策略
2. [WebSocket vs RTC 指南](WEBSOCKET_VS_RTC_GUIDE.md) - 通信协议
3. [API 规范](API_SPECIFICATION.md) - 接口文档

**部署上线**：
1. [部署指南](DEPLOYMENT_GUIDE.md) - 完整流程
2. [Docker 配置](../docker-compose.yml) - 容器编排

---

## 📊 文档优先级说明

- ⭐⭐⭐ **必读** - 核心文档，开发前必读
- ⭐⭐ **推荐** - 重要文档，建议阅读
- ⭐ **参考** - 可选文档，需要时查阅

---

## 🔄 文档维护

### 添加新文档

1. 在对应分类下创建文档
2. 更新本导航文件
3. 在根目录 `CLAUDE.md` 中同步更新链接

### 文档命名规范

- 使用大写蛇形命名：`DOCUMENT_NAME.md`
- 清晰描述文档内容
- 避免缩写（除非是通用缩写）

---

## 🔗 相关资源

- [项目主文档](../CLAUDE.md)
- [当前任务](../.tasks/current.md)
- [GitHub 仓库](https://github.com/AIden-QiU1/VoxFlame-Agent)

---

**让每个声音都被听见** 🎗️
