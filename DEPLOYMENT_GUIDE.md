# VoxFlame Agent 部署指南

## 🎯 系统要求

- Python 3.10.x
- Node.js 14+  
- TEN Manager (tman) 0.11.48
- 4GB+ RAM
- Linux/macOS (推荐)

## 📦 已完成的配置升级

### 1. TEN Framework 标准化 (2026-01-02)

所有配置文件已升级到 TEN Framework 0.11.48 标准：

**主配置** (2个):
- `ten_agent/manifest.json` ✅
- `ten_agent/property.json` ✅

**扩展配置** (10个):
- backend_webhook_python ✅
- cosyvoice_tts_python ✅
- dashscope_asr_python ✅
- dashscope_llm_python ✅
- dashscope_tts_python ✅
- funasr_asr_python ✅
- http_api_server_python ✅
- main_python ✅
- text_webhook ✅
- websocket_server_python ✅

### 2. LLM 迁移 GLM-4 → QWEN3-Max

- 删除 `glm_llm_python` 扩展
- 创建 `dashscope_llm_python` 扩展
- 更新所有引用和文档
- 配置文件: `.env`, `property.json`

### 3. 前端改进 (100% 测试通过)

- **chat 页面**: 响应式 + 无障碍设计 (5/5 ✅)
- **ChatInterface**: TTS 音频播放功能 (8/8 ✅)
- **agent-client**: 连接管理 + 重连机制 (8/8 ✅)

## 🚀 快速开始

### 步骤 1: 安装 TEN Manager

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/TEN-framework/ten-framework/main/tools/tman/install_tman.sh)
```

验证安装:
```bash
tman --version
# TEN Framework version: 0.11.48
```

### 步骤 2: 安装依赖

```bash
cd ten_agent
tman install
```

预期输出:
```
🏆 Install successfully in 2 seconds
```

### 步骤 3: 配置环境变量

```bash
cd ten_agent
cat > .env << 'ENV'
DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_LLM_MODEL=qwen3-max
ENV
```

### 步骤 4: 启动服务

#### 前端 (Next.js)

```bash
cd frontend
npm install
npm run dev
```

访问: http://localhost:3000

#### 后端 Agent (TEN Framework)

```bash
cd ten_agent

# 设置 Python 路径
export PYTHONPATH=ten_packages/system/ten_runtime_python/lib:ten_packages/system/ten_runtime_python/interface

# 启动
python3 start_agent.py
```

预期端口:
- HTTP API: 8080
- WebSocket: 8765

## 📋 验证清单

### TEN Agent 依赖

```bash
cd ten_agent
ls -la ten_packages/system/
```

应该看到:
- `ten_runtime/`
- `ten_runtime_python/`

### 前端服务

```bash
curl http://localhost:3000
# 应返回 HTML
```

### Agent 服务  

```bash
curl http://localhost:8080/health
# {"status": "ok", "active_sessions": 0}
```

## 🔧 故障排除

### 问题 1: tman 未找到

```bash
# 添加到 PATH
export PATH="/usr/local/bin:$PATH"
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 问题 2: tman install 失败

检查 manifest.json:
```bash
cd ten_agent
tman check manifest-json --path manifest.json
```

### 问题 3: Python 导入错误

确保 PYTHONPATH 正确:
```bash
export PYTHONPATH=ten_packages/system/ten_runtime_python/lib:ten_packages/system/ten_runtime_python/interface
```

### 问题 4: 端口被占用

检查端口:
```bash
ss -tuln | grep -E "3000|8080|8765"
```

杀死占用进程:
```bash
kill $(lsof -t -i:8080)
```

## 📊 测试结果

### 配置验证

- ✅ manifest.json: 所有 12 个文件通过 schema 验证
- ✅ 依赖安装: ten_runtime 0.11.48 + ten_runtime_python 0.11.48
- ✅ 扩展识别: 10 个本地扩展全部识别

### 前端测试

- ✅ 代码测试: 21/21 通过 (100%)
- ✅ 页面渲染: 所有页面正常加载
- ✅ 响应式设计: 移动端/桌面端适配
- ✅ 无障碍: ARIA 标签完整

## 📝 下一步

### 短期任务

1. 完成 Agent 启动调试 (property.json graph 配置)
2. WebSocket 端到端测试
3. 音频流水线测试 (ASR → LLM → TTS)

### 中期任务

4. 后端 API (Node.js) 集成
5. Supabase 数据库连接
6. PowerMem 记忆管理测试

### 长期任务

7. Docker Compose 部署
8. 性能优化和监控
9. 生产环境配置

## 🔗 相关文档

- [TEN Framework 官方文档](https://theten.ai/docs)
- [DashScope API 文档](https://help.aliyun.com/zh/dashscope/)
- [项目架构说明](./ARCHITECTURE.md)
- [前端改进报告](./FINAL_REPORT.md)

---

**最后更新**: 2026-01-02  
**TEN Framework 版本**: 0.11.48  
**Node.js 版本**: 14+  
**Python 版本**: 3.10.x
