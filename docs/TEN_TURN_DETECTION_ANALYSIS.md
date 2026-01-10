# TEN Turn Detection 深度分析报告

> 更新时间: 2025年12月
> GitHub: https://github.com/TEN-framework/ten-turn-detection
> Star: 504
> 模型: https://huggingface.co/TEN-framework/TEN_Turn_Detection

---

## 一、TEN Turn Detection 概述

TEN Turn Detection 是一个专为人机对话设计的智能轮次检测模型，用于实现全双工对话通信。它解决了人机对话中最具挑战性的问题之一：**检测自然的轮换线索并实现上下文感知的打断**。

### 1.1 核心功能

基于Transformer语言模型(Qwen2.5-7B)进行语义分析，将用户文本分类为三种状态：

| 状态 | 英文 | 描述 | 示例 |
|------|------|------|------|
| 完成 | `finished` | 用户表达完整，期待回应 | "你好，我想问一下订单的事情" |
| 等待 | `wait` | 用户明确要求AI不要说话 | "等一下" / "闭嘴" |
| 未完成 | `unfinished` | 用户暂停但打算继续说 | "你好，我想问一下..." |

### 1.2 与VAD的区别

| 模块 | 检测对象 | 输入 | 输出 |
|------|----------|------|------|
| **TEN VAD** | 音频信号 | 音频帧 | start/end_of_sentence |
| **Turn Detection** | 语义内容 | 文本 | finished/wait/unfinished |

**协作关系**:
```
音频 → VAD(检测语音边界) → ASR(转文本) → Turn Detection(判断语义完整性)
```

---

## 二、技术架构

### 2.1 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                  TEN Turn Detection 架构                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────┐     ┌──────────────┐     ┌───────────────┐  │
│  │ ASR文本   │ ──► │ 去标点处理    │ ──► │ LLM语义分析   │  │
│  │ (text)    │     │              │     │ (Qwen2.5-7B)  │  │
│  └───────────┘     └──────────────┘     └───────────────┘  │
│                                                │            │
│                                                ▼            │
│                                         ┌───────────────┐  │
│                                         │ 轮次决策      │  │
│                                         │ finished/     │  │
│                                         │ unfinished/   │  │
│                                         │ wait          │  │
│                                         └───────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 处理流程

```python
# 1. 接收ASR文本
input_text = "你好，我想问一下"  # is_final=True

# 2. 去除标点
no_punc_text = remove_punctuation(input_text)  # "你好我想问一下"

# 3. 调用LLM分类
messages = [{"role": "user", "content": no_punc_text}]
response = await openai_client.chat.completions.create(
    messages=messages,
    model="TEN_Turn_Detection",
    max_tokens=1,  # 只需要一个token
    temperature=0.1
)

# 4. 解析结果
content = response.choices[0].message.content
if content.startswith("finished"):
    decision = TurnDetectorDecision.Finished
elif content.startswith("wait"):
    decision = TurnDetectorDecision.Wait
else:
    decision = TurnDetectorDecision.Unfinished
```

### 2.3 状态转换图

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
     ASR文本输入    │     TEN Turn Detection 状态流           │
          │         │                                         │
          ▼         │  ┌──────────┐                           │
    ┌─────────┐     │  │ finished │ ──► 发送final文本给LLM    │
    │ 去标点   │ ──► │  └──────────┘                           │
    │ 预处理   │     │        │                               │
    └─────────┘     │        ▼ 或                             │
                    │  ┌──────────┐                           │
                    │  │   wait   │ ──► 不发送，等待用户继续   │
                    │  └──────────┘                           │
                    │        │                               │
                    │        ▼ 或                             │
                    │  ┌───────────┐                         │
                    │  │unfinished │ ──► 启动force_chat定时器  │
                    │  └───────────┘     (超时后强制触发)     │
                    │                                         │
                    └─────────────────────────────────────────┘
```

---

## 三、配置参数

### 3.1 TENTurnDetectorConfig

```python
class TENTurnDetectorConfig(BaseModel):
    base_url: str = "http://localhost:8000/v1"  # 模型服务地址
    api_key: str = "TEN_Turn_Detection"         # API密钥
    model: str = "TEN_Turn_Detection"           # 模型名称
    temperature: float = 0.1                     # 低温度，更确定性
    top_p: float = 0.1                           # 低采样范围
    force_threshold_ms: int = 5000               # 强制触发超时(ms)
```

### 3.2 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `base_url` | localhost:8000 | 模型服务端点，需要部署TEN Turn Detection模型 |
| `temperature` | 0.1 | 低温度确保分类结果稳定 |
| `top_p` | 0.1 | 限制采样范围，提高一致性 |
| `force_threshold_ms` | 5000ms | 如果5秒内未决策为finished，强制触发 |

### 3.3 force_chat机制

当用户输入被判断为`unfinished`时：
1. 启动一个5秒定时器
2. 如果5秒内没有新输入或仍未达到finished状态
3. 强制触发对话，避免用户一直等待

---

## 四、性能对比

### 4.1 检测准确率

| 语言 | 模型 | Finished准确率 | Unfinished准确率 | Wait准确率 |
|------|------|----------------|------------------|------------|
| 英语 | Model A | 59.74% | 86.46% | N/A |
| 英语 | Model B | 71.61% | 96.88% | N/A |
| **英语** | **TEN Turn Detection** | **90.64%** | **98.44%** | **91%** |
| 中文 | Model B | 74.63% | 88.89% | N/A |
| **中文** | **TEN Turn Detection** | **98.90%** | **92.74%** | **92%** |

### 4.2 关键优势

- **中英双语支持**: 同时支持英语和中文
- **Wait状态检测**: 唯一支持wait状态的开源模型
- **高准确率**: 中文finished检测达98.90%

---

## 五、在TEN Framework中的集成

### 5.1 Graph配置

```json
{
  "nodes": [
    {
      "type": "extension",
      "name": "turn_detection",
      "addon": "ten_turn_detection",
      "extension_group": "default",
      "property": {
        "base_url": "${env:TTD_BASE_URL|}",
        "api_key": "${env:TTD_API_KEY|}"
      }
    }
  ],
  "connections": [
    {
      "extension": "turn_detection",
      "data": [
        {
          "name": "text_data",
          "dest": [{"extension": "main_control"}]
        }
      ],
      "cmd": [
        {
          "name": "flush",
          "dest": [{"extension": "main_control"}]
        }
      ]
    }
  ]
}
```

### 5.2 完整数据流

```
Audio Input
    │
    ▼
┌───────────────┐
│ streamid_     │
│ adapter       │
└───────────────┘
    │
    ├──────────────────┐
    ▼                  ▼
┌─────────┐      ┌──────────┐
│   STT   │      │   VAD    │
│  (ASR)  │      │          │
└─────────┘      └──────────┘
    │                  │
    │ text_data        │ start/end_of_sentence
    ▼                  │
┌───────────────┐      │
│    Turn       │      │
│  Detection    │      │
└───────────────┘      │
    │                  │
    │ text_data        │
    │ (is_final=true)  │
    └───────┬──────────┘
            ▼
    ┌───────────────┐
    │ main_control  │
    └───────────────┘
            │
            ▼
    ┌───────────────┐
    │     LLM       │
    └───────────────┘
```

### 5.3 关键输出

| 输出类型 | 名称 | 条件 | 内容 |
|----------|------|------|------|
| Data | text_data | is_final=true | 决策为finished时的完整文本 |
| Data | text_data | is_final=false | 非最终文本，用于实时显示 |
| Cmd | flush | 新轮次开始 | 清除之前的状态 |

---

## 六、部署方式

### 6.1 模型部署

Turn Detection需要部署一个LLM服务：

```bash
# 方式1: 使用HuggingFace模型
git clone https://huggingface.co/TEN-framework/TEN_Turn_Detection

# 方式2: 使用vLLM或其他推理引擎部署
# 模型基于Qwen2.5-7B微调
```

### 6.2 推理示例

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "TEN-framework/TEN_Turn_Detection"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id)

# 推理
text = "Hello I have a question about"
inputs = tokenizer(text, return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=1)
result = tokenizer.decode(outputs[0], skip_special_tokens=True)
# result: "unfinished"
```

### 6.3 环境变量

```bash
TTD_BASE_URL=http://your-model-server:8000/v1
TTD_API_KEY=your-api-key
```

---

## 七、VAD + Turn Detection 协作

### 7.1 典型工作流程

```
时间线:
t0: 用户开始说话
    └─ VAD: start_of_sentence
    
t1: 用户说 "你好，我想问一下..."
    └─ ASR: text="你好，我想问一下"
    └─ Turn Detection: unfinished (用户还没说完)
    
t2: 用户暂停思考 (500ms静默)
    └─ VAD: (仍在SPEAKING，未触发end)
    └─ Turn Detection: 启动force_chat定时器
    
t3: 用户继续说 "...订单什么时候能到"
    └─ ASR: text="订单什么时候能到"
    └─ Turn Detection: 取消定时器，继续累积
    
t4: 用户停止说话 (1000ms静默)
    └─ VAD: end_of_sentence
    └─ ASR: 发送final文本
    └─ Turn Detection: finished → 发送给LLM
    
t5: LLM响应
    └─ Agent开始回答
```

### 7.2 处理打断

当Agent正在回答，用户想打断时：

```
Agent说话中:
t0: 用户说 "等一下"
    └─ VAD: start_of_sentence
    └─ 系统: 静音Agent
    └─ ASR: text="等一下"
    └─ Turn Detection: wait
    └─ 系统: 不触发新对话，等待用户继续
    
t1: 用户说 "我想问另一个问题"
    └─ Turn Detection: finished
    └─ 系统: 发送新问题给LLM
```

---

## 八、构音障碍场景适配

### 8.1 挑战

构音障碍患者的语音特点对Turn Detection的影响：
- 说话速度慢 → 更长的停顿
- 发音不清 → ASR识别错误
- 句子结构可能不完整

### 8.2 建议配置

```json
{
  "type": "extension",
  "name": "turn_detection",
  "addon": "ten_turn_detection",
  "property": {
    "force_threshold_ms": 8000,  // 延长超时到8秒
    "temperature": 0.2           // 略微提高容错性
  }
}
```

### 8.3 与LLM纠错的配合

```
ASR输出 (可能有错误)
    │
    ▼
Turn Detection (判断是否说完)
    │
    ▼ 如果 finished
LLM纠错扩展 (纠正ASR错误)
    │
    ▼
输出纠正后的文本
```

---

## 九、VoxFlame-Agent集成建议

### 9.1 集成架构

```
WebSocket → VAD ──────────────────────────────────┐
              ↓                                   │
          Aliyun ASR                              │
              ↓                                   │
          Turn Detection ─────────────────────────┼──► main_control
              ↓                                   │
          LLM纠错扩展                              │
              ↓                                   │
          输出纠正文本 ◄───────────────────────────┘
```

### 9.2 部署要求

1. **模型服务**: 需要部署TEN Turn Detection模型
   - 推荐使用vLLM或TGI
   - 模型大小约7B参数
   - 需要GPU支持

2. **或使用OpenAI兼容API**:
   - 可以使用其他LLM提供类似功能
   - 需要设计合适的prompt

### 9.3 简化方案

如果不想部署7B模型，可以考虑：

1. **使用云端LLM**: 使用Qwen/GPT等云服务，设计分类prompt
2. **基于规则**: 简单的启发式规则判断句子完整性
3. **仅使用VAD**: 只依赖VAD的end_of_sentence

---

## 十、测试数据集

TEN提供了开源测试数据集:

```
TEN-Turn-TestSet/
├── wait.txt       # 请求暂停/终止的表达
├── unfinished.txt # 未完成的对话
└── finished.txt   # 完整的对话
```

可用于评估和微调Turn Detection模型。

---

## 参考资源

- GitHub仓库: https://github.com/TEN-framework/ten-turn-detection
- HuggingFace模型: https://huggingface.co/TEN-framework/TEN_Turn_Detection
- 在线体验: https://huggingface.co/spaces/TEN-framework/ten-agent-demo
- TEN Framework: https://github.com/TEN-framework/ten-framework

