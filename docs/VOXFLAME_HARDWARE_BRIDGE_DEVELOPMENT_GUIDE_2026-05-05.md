# VoxFlame Hardware Bridge Development Guide（2026-05-05）

> 目标：先把硬件变成 App / Web 的可靠辅助入口，而不是一上来做一台完整语音终端。

这份文档给出 VoxFlame 第一阶段硬件开发路线：买什么、怎么连、怎么开发、怎么和现有 LiveKit / mobile workbench 主链协作。

## 1. 当前结论

第一阶段硬件要围绕两个真实功能做：`发声` 和 `记录`。

1. `发声`：把系统理解后的内容清楚、稳定、可中断地播放给对方听。
2. `记录`：把用户说话、训练样本或现场沟通片段清楚、可追踪地录下来。

但第一阶段仍然不要让 ESP32 直接承接 LiveKit 实时语音，也不要让 ESP32 自己跑 ASR / LLM / TTS。

推荐路线是：

```text
ESP32-S3 / BLE 按钮 / 外接麦 / 小喇叭 / 脚踏
  -> mobile workbench / desktop companion
  -> backend /api/*
  -> backend /api/rtc/session/*
  -> self-hosted LiveKit
  -> livekit_agent
```

原因：

1. VoxFlame 当前唯一实时主链已经是 `Frontend / App -> Backend -> LiveKit -> livekit_agent`。
2. ESP32-S3 适合低功耗控制、BLE、Wi-Fi、I2S 录音和简单状态灯；不适合第一版直接扛完整 WebRTC / LiveKit 实时沟通。
3. ESP32-S3 可以做短音频录制、本地提示音、预置短句播放和最近录音回放；不适合第一版做高质量实时 TTS 流播放。
4. 用户价值最短路径不是“做一台完整硬件终端”，而是把收音、播放、按钮、状态灯这几件事做可靠。
5. 硬件事件必须进入 App 后由用户可见地映射到录音、回放、中断和上传，不让设备直接触发高风险副作用。

## 2. 发声与记录功能定义

### 2.1 发声不是一件事

VoxFlame 硬件里的发声分三层：

| 层级 | 第一版推荐实现 | 说明 |
|---|---|---|
| 状态提示音 | ESP32-S3 + I2S amp + 小喇叭 | 连接成功、开始录音、停止录音、上传完成、错误提醒 |
| 预置短句 / 最近录音回放 | ESP32-S3 播放本地 WAV，或 App 控制手机 / 蓝牙音箱播放 | 例如“请稍等”“我正在输入”“再说一遍” |
| 实时 TTS / 翻译器输出 | App / Web / desktop companion 播放 | TTS 文本生成、音频生成、LiveKit session 和中断控制仍由 App / backend owner 承接 |

关键判断：

1. 如果只是“让别人听见”，第一版最稳的是手机外放、蓝牙音箱或有线小音箱，由 App 播放 TTS。
2. 如果要做自研小盒子发声，ESP32-S3 先只负责提示音、预置 WAV 和最近录音回放。
3. 如果目标是完整实时语音终端，ESP32-S3 不是合适主控；后续应评估 Raspberry Pi / Linux SBC / Android 小主机。
4. ESP32-S3 只有 BLE，没有经典蓝牙 A2DP 音箱路径；不要假设手机可以像连普通蓝牙音箱一样把 TTS 音频流推给 ESP32-S3。

### 2.2 记录也不是一件事

VoxFlame 硬件里的记录分三类：

| 类型 | 第一版推荐实现 | 进入系统方式 |
|---|---|---|
| 训练样本记录 | ESP32-S3 + I2S MEMS mic + WAV，本地缓存后由 App 或 backend 上传 | `recording envelope -> upload receipt -> manifest -> voice_contributions` |
| 沟通现场记录 | App / LiveKit room 侧记录 session-local audio / transcript | 不让硬件绕过 App 直接写 memory |
| 设备质量记录 | ESP32-S3 上报输入路线、音量、削波、噪声、按钮事件、断连 | 先做 telemetry，不直接写用户画像 |

关键判断：

1. 第一版硬件录音先服务训练样本和收音质量验证，不承诺完整实时沟通录音。
2. 硬件开始录音必须有物理灯或屏幕提示，App 里也必须显示正在录音。
3. 硬件未上传录音默认留在本地或 App 本地队列，用户能看见、重试、删除。
4. 没有 App 登录态时，硬件不能直接把录音归到某个用户账户。

### 2.3 第一版硬件形态建议

第一块值得做的 VoxFlame 硬件不是“独立 AI 语音机”，而是：

```text
便携音频桥：
  - 1 个 I2S MEMS 麦克风，用于训练样本和收音验证
  - 1 个小喇叭，用于提示音、预置短句、最近录音回放
  - 2-4 个实体按钮，用于开始/停止记录、重放、打断发声
  - 1 个 RGB LED 或小屏，用于显示录音/连接/上传/错误状态
  - BLE 连接 App，Wi-Fi 只在明确需要上传原型时启用
```

App 仍然是 brain，硬件是 mouth / ear / button / status surface。

## 3. 现有硬件形态和设计标准调查

这一节把现有录音 / 发音硬件拆成可执行的设计输入。结论是：很多能力市场上已经存在，VoxFlame 不应该重新发明“会发声的盒子”，而要把硬件形态重新设计成贴近构音障碍真实沟通的 `理解型沟通助手`。

### 3.1 现有形态一：大屏 SGD / AAC 设备

代表：

| 产品 / 类型 | 已验证的硬件模式 | 对 VoxFlame 的启发 |
|---|---|---|
| Tobii Dynavox TD I-Series | 眼控、2 个 10W closed-box speakers、模拟麦克风、USB、3.5mm switch interface、耳机口、可编程按钮、Windows IoT | 专业 SGD 会把外放、可替代输入、可编程按钮和安装接口做成核心硬件，不只是软件 |
| PRC-Saltillo Via Pro | iOS SGD、保护 wrap、handle、stand、Bluetooth amplifier / speakers、switch / head tracking、IP44、10-12h battery、wheelchair mounting accessories | 可靠沟通设备需要耐用外壳、支架、挂载、外放增强和明确的环境 / 温度 / 湿度边界 |
| Lingraphica TouchTalk / MiniTalk | 8-12.4 inch tablet family、rugged case、built-in stand、crossbody strap、stylus、Bluetooth speaker / keyboard / joystick / stylus accessories | 形态不是单一设备，而是主机 + 配件生态；小尺寸和携带方式是产品分层 |
| Jabbla Allora 3 | 物理键盘、前屏、后置 partner display、2 speakers、integrated microphone、message history、translation、Bluetooth、Wi-Fi、mounting | 面向真实对话时，partner display / message history 比“更酷的硬件”更直接改善面对面沟通 |

借鉴项：

1. 强外放和音量控制是刚需，不是锦上添花。
2. 麦克风、扬声器、实体按钮、挂载 / 佩戴方式、保护壳是一套系统。
3. 真实沟通中 partner-facing output 很重要：不一定是第二块屏，也可以是朝向对方的灯、屏、扬声器或手机 UI。
4. 设备需要支持多种 access method：触控只是其中一种，按钮、脚踏、switch、头控 / 眼控接口都可能进入未来路线。

不照搬项：

1. 不把第一版做成 8-13 inch 大平板 SGD。
2. 不复制成熟 AAC 语言系统的图标 / 符号板竞争路线。
3. 不把“用户必须点选文字再发声”作为唯一交互。

VoxFlame 差异：

```text
现有 SGD:
  用户组织文本/符号 -> 设备发声

VoxFlame:
  用户尽量自然说话 -> 系统理解/纠错 -> 必要时替用户清楚说出 -> 记录失败和成功样本 -> 长期更懂这个人
```

### 3.2 现有形态二：简单录放音 AAC / 可穿戴消息器

代表：

| 产品 / 类型 | 已验证的硬件模式 | 对 VoxFlame 的启发 |
|---|---|---|
| AbleNet BIGmack | 一个大按钮、直接录音、最长约 2 分钟播放、大面积触发面、外接 switch、玩具 / appliance 输出、9V 电池 | “录一句、按一下播一句”的低认知负担非常强；大按钮和清晰状态比复杂功能更重要 |
| GoTalk Select | 约 7 x 7.5 cm 可穿戴 / 口袋设备、4 个按钮、3 层共 12 条消息、USB 充电、内置喇叭、可替换 overlay | 可穿戴短句设备证明了随身沟通硬件可小型化；按钮数量应少而明确 |
| Forbes SoundPOD | 可穿戴 speaker，让声音从用户身上发出，而不是从平板方向发出 | “声音从哪里来”会影响对话中的视线、尊严和自然感 |
| Forbes Personify | 面向渐进性疾病的 legacy message recording / cloud backup | 记录不是只有训练数据，也可能是用户身份和个性化表达资产 |

借鉴项：

1. 物理按钮必须能盲按，不能依赖用户每次看屏幕。
2. 设备上的发声位置会改变对方看谁、听谁、是否打断用户。
3. 快速录放音是强基线能力：即使 AI 不可用，也能“记录一条、播放一条”。
4. 可穿戴 / 口袋 / 夹在衣服上的形态值得优先验证。

不照搬项：

1. 不把 VoxFlame 限制成固定 4 / 12 条预录短句。
2. 不让硬件成为孤岛；录音、回放、上传、训练反馈必须能回到 App 和 backend 事实源。

### 3.3 现有形态三：随身语音扩音器

代表：

| 产品 / 类型 | 已验证的硬件模式 | 对 VoxFlame 的启发 |
|---|---|---|
| ChatterVox / ADDvox / Hisonic / EchoVoice 等 waist-worn amplifier | 头戴 / 领夹 / collar mic + 腰挂 speaker，约 5-10W 输出，约 15dB voice boost，6-14h battery | 对低音量、疲劳、餐厅和人群场景，近嘴麦 + 随身 speaker 是已验证形态 |
| VoiceBooster 类教师 / 导游扩音器 | 腰夹或肩带、大音量、长续航、麦克风输入、MP3 输入 | 成本低、可快速验证“听得见”这件事；但不解决系统理解和数据闭环 |

借鉴项：

1. 第一阶段应买现成 USB-C / 领夹 / 头戴麦和便携音箱做基准测试。
2. 目标不只是音质，而是沟通距离、环境噪声下的可懂度和用户省力程度。
3. 腰挂、胸前、桌面三种佩戴 / 放置方式都要测试。

不照搬项：

1. 单纯扩音只放大原声，不能纠正系统对构音障碍语音的理解。
2. 如果用户发音含糊，扩音器可能把“听不懂”放大得更响；VoxFlame 的关键是理解和修复。

### 3.4 VoxFlame 应落地的硬件标准

第一版标准名：`VoxFlame Communication Audio Bridge Standard v0.1`。

目标设备不是医疗终端上市版，而是可供真实场景验证的工程样机。标准按 `P0 / P1 / P2` 分级：

| 模块 | P0 样机必须达到 | P1 小范围内测 | P2 产品化 |
|---|---|---|---|
| 形态 | 口袋 / 胸前 / 桌面三选一，单手可拿起 | 支持胸前夹持 + 桌面支架 | 可清洁外壳、挂绳、夹子、桌面支架、轮椅 / 床边扩展 |
| 重量 | 手持样机尽量 < 250g；桌面样机可更重 | 可穿戴部分 < 180g | 可穿戴部分 < 120g，或把重件留在手机 / 桌面 |
| 麦克风 | 16kHz mono WAV，近场 20-40cm 可懂；有削波 / 音量过低提示 | 支持领夹 / 头戴 / I2S MEMS 至少两种输入路线比较 | 定义主麦、备选外接麦和环境噪声策略 |
| 扬声器 | 可播放提示音、预置短句、最近录音；有硬件停止键 | 0.5-1m 内普通房间清晰可听；支持外接蓝牙 / 有线音箱由 App 播放 | 外放声源朝向对方，兼顾用户隐私和对话自然感 |
| 按钮 | 至少 3 个：记录、重放 / 发声、停止 / 打断 | 4 个：记录、确认发声、重放、停止 / 打断 | 可替换贴纸 / 触感标记 / 颜色编码 / 防误触 |
| 状态 | LED 显示连接、录音、播放、上传、错误 | App 和硬件状态一致，断连有明确提示 | 可选 partner-facing 简短状态屏 |
| 离线 | AI 不可用时仍能录音、回放最近录音、播放预置提示 | 本地缓存不少于 30 条短录音 | 本地加密缓存，支持批量上传和清理 |
| 上传 | 不保存用户 token；通过 App 代上传或 staging + App 认领 | upload receipt / manifest / voice_contributions 对齐 | 设备、App、backend 三方可审计 |
| 电池 | 样机可 USB 供电；电池版至少 2h 连续测试 | 6h 日常使用 | 8-10h 日常使用，安全充电和运输合规 |
| 隐私 | 上电不自动录音；录音时硬件和 App 都可见 | 用户能删除未上传录音 | 录音、上传、删除有完整日志和用户控制 |

### 3.5 音频标准

记录输入 P0：

```text
format: WAV PCM
sample_rate: 16000 Hz
bit_depth: 16-bit
channels: mono
max_clip_ratio: < 1%
target_distance: 20-40 cm
max_single_recording: 10 s for training prompt, 60 s for free note prototype
metadata_required:
  - device_type
  - input_route
  - input_gain
  - clipping_detected
  - duration_ms
  - sample_rate
  - channel_count
  - source_surface
```

发声输出 P0：

```text
local_playback:
  - status_beep
  - built_in_prompt_wav
  - replay_latest_recording
app_playback:
  - realtime_tts
  - translated_intent
  - long assistant output
hardware_controls:
  - stop_playback
  - replay_last
  - volume_down
  - volume_up
```

音量安全：

1. P0 用声级计或手机声级计做相对测量，不宣称认证。
2. 默认模式面向对话距离，不追求持续高声压。
3. 参考 WHO safe listening：个人音频设备应关注音量和时长；参考 NIOSH：85 dBA 8 小时 TWA 是职业噪声风险基准。
4. 样机默认避免长时间近耳播放；如果接耳机 / 骨传导，必须有音量限制和提示。
5. 外放模式可以有“嘈杂环境增强”，但要有明显图标和超时回落。

### 3.6 人因和可用性标准

VoxFlame 硬件的可用性不按“功能多”评分，而按真实沟通失败减少评分。

必须覆盖的使用场景：

1. 用户在餐厅 / 课堂 / 诊室想说一句短话。
2. 用户说完后系统没听懂，需要重说 / 重放 / 打断。
3. 用户不想公开某句话，需要取消播放。
4. 用户录了训练样本，但暂时没网，需要稍后上传。
5. 用户或照护者需要知道：现在有没有在录音？有没有上传？能不能删除？

P0 人因标准：

| 设计面 | 标准 |
|---|---|
| 录音可见性 | 硬件红灯 / App 文案同时显示；停止后状态立即变化 |
| 播放可控性 | 任意发声必须有 1 个物理停止 / 打断路径 |
| 误触控制 | 长按或双击用于高风险动作；短按只触发低风险动作 |
| 盲操作 | 主按钮有触感差异；用户不看屏也能开始 / 停止 |
| 认知负担 | 第一版不超过 4 个主按钮 |
| 失败恢复 | 断连、没网、上传失败都保留本地录音并显示下一步 |
| 照护者协作 | App 可显示设备状态和最近事件，不让照护者猜 |

### 3.7 安全、合规和认证路线

这不是法律结论，而是工程默认路线。正式上市前需要找合规顾问和测试实验室确认。

| 阶段 | 定位 | 标准 / 合规工作 |
|---|---|---|
| H0 / H1 工程样机 | 内部验证，不对外销售 | 使用现成认证手机、麦克风、音箱；自研板只做开发，不宣称医疗用途 |
| H2 / H2.5 小范围测试 | 研究 / 可用性测试样机 | 建立 ISO 14971 风格 risk file、IEC 62366-1 风格 use error 分析；记录故障、误触、隐私事件 |
| Beta 硬件附件 | 沟通辅助 accessory | 以 IEC 62368-1 的 AV / ICT 安全思路做电气、热、机械、火灾防护；BLE/Wi-Fi 走 FCC / CE RED / SRRC 等无线合规路径 |
| 医疗 / SGD 路线 | 若声明 speech generating device / 康复辅助设备 / 保险报销 | 需要重新评估 FDA / NMPA / EU MDR 分类、IEC 60601-1 / 60601-1-11、IEC 62366-1、ISO 14971、软件生命周期和临床 / 可用性证据 |

底线：

1. 第一版文档和 demo 只称 `communication audio bridge prototype`，不称治疗设备、诊断设备或可替代临床 AAC 评估。
2. 如果未来要作为 speech generating device 或 durable medical equipment 路线进入美国保险 / 医疗系统，需要单独建 regulatory plan。
3. 所有电池必须采购已有 UN 38.3 / IEC 62133-2 资料的电芯或电池包；不要自制裸电池包给用户试用。
4. 所有 BLE / Wi-Fi 模块优先用已有模块认证资料的模组，减少射频合规风险。
5. 外壳和连接器必须考虑汗液、口水、雨水、跌落、儿童小件、夹手、挂绳勒颈、充电发热。

### 3.8 P0 基准测试清单

先买现成产品做 benchmark，再决定自研形态。

| 物品 | 目的 | 验收问题 |
|---|---|---|
| USB-C 领夹麦 | 验证手机 / App 直接录音质量 | 比手机内置麦 ASR / 人耳可懂度提升多少？ |
| 头戴麦 + 便携扩音器 | 验证近嘴麦 + 腰挂 speaker | 低音量用户是否更省力？是否啸叫？是否尴尬？ |
| 便携蓝牙音箱 | 验证 App TTS 外放 | 0.5m / 1m / 餐厅噪声下是否听清？ |
| GoTalk Select 类可穿戴消息器 | 验证 4 按钮 + 12 短句模型 | 用户是否愿意随身带？按钮数量是否合适？ |
| BIGmack 类大按钮录放音器 | 验证低认知负担录放音 | 大按钮是否比 App UI 更可靠？ |
| ESP32-S3 + I2S mic + MAX98357A | 验证自研音频桥最小技术可行性 | 能否稳定录、播、显示状态、通过 App 上传？ |

P0 输出必须包括：

1. 每个现成设备的照片 / 重量 / 佩戴方式 / 音量 / 电池 / 用户感受。
2. 每个场景至少 5 条录音样本，进入现有 OSS / manifest / voice_contributions 或本地测试集。
3. 对比表：手机内置麦、USB-C 领夹麦、ESP32 I2S mic 的 ASR 结果和人工可懂度。
4. 对比表：手机外放、蓝牙音箱、ESP32 小喇叭在 0.5m / 1m / 噪声场景的可听度。
5. 下一版硬件形态决策：胸前、桌面、腰挂、手机壳 / MagSafe、轮椅 / 床边。

### 3.9 参考资料入口

现有设备：

1. Tobii Dynavox TD I-Series：`https://www.tobiidynavox.com/products/td-i-series`
2. PRC-Saltillo Via Pro specifications：`https://documentation.prc-saltillo.com/docs/via-pro-112-specifications`
3. Lingraphica AAC devices：`https://lingraphica.com/aac-devices/`
4. Lingraphica accessories：`https://lingraphica.com/aac-devices/aac-device-accessories/`
5. Jabbla Allora 3：`https://www.jabbla.com/en/devices/allora-3-2/`
6. Forbes SoundPOD：`https://www.forbesaac.com/soundpod`
7. Forbes Personify：`https://www.forbesaac.com/personify`
8. AbleNet BIGmack：`https://www.ablenetinc.com/bigmack/`

标准 / 合规：

1. ISO 14971 medical device risk management：`https://www.iso.org/standard/72704.html`
2. IEC 62366-1 medical device usability engineering：`https://www.iso.org/standard/63179.html`
3. IEC 62368-1 AV / ICT equipment safety：`https://webstore.iec.ch/en/publication/27412`
4. IEC 60601-1-11 home healthcare medical electrical equipment：`https://www.iso.org/standard/65529.html`
5. IEC 62133-2 lithium battery safety：`https://webstore.ansi.org/standards/iec/iec62133ed2017-1649322`
6. FCC Part 15 intentional radiators：`https://www.law.cornell.edu/cfr/text/47/part-15/subpart-C`
7. CMS Speech Generating Devices coverage：`https://www.cms.gov/medicare-coverage-database/view/medicare-coverage-document.aspx?mcdid=26`
8. WHO safe listening devices and systems：`https://www.who.int/publications/i/item/9789241515276`
9. CDC / NIOSH noise exposure：`https://www.cdc.gov/niosh/noise/about/noise.html`

## 4. 阶段路线

### Phase H0：现成外设验证

目标：

1. 手机 + 蓝牙耳机 / USB-C 麦克风是否明显改善记录质量。
2. 手机外放 / 便携蓝牙音箱是否足够承担沟通发声。
3. App / PWA 能显示输入设备、输出设备、权限和本地队列状态。
4. 训练样本 metadata 预留 `device_type / input_route / output_route / input_quality`。

不买自研板也能做。

### Phase H1：ESP32-S3 BLE 控制桥

目标：

1. ESP32-S3 作为 BLE peripheral。
2. 手机 App 作为 BLE central。
3. 硬件按钮发送事件：
   - `capture_start`
   - `capture_stop`
   - `replay_last`
   - `interrupt_tts`
4. ESP32-S3 只做提示音，不录音、不上传。
5. App 显示连接状态、最近事件、设备电量。
6. App 再把事件映射到现有 recorder queue / LiveKit session。

这是第一块真正值得做的硬件原型，先证明“按钮 + 发声控制 + 录音控制”对用户有帮助。

### Phase H2：ESP32-S3 I2S 记录原型

目标：

1. ESP32-S3 接 I2S MEMS 麦克风。
2. 录制短音频片段。
3. 保存为 PCM / WAV。
4. App 能看到硬件本地待上传记录，或硬件通过 staging endpoint 上传后由 App 确认认领。
5. 最终进入现有 `recording envelope -> upload receipt -> manifest` 链。

这条线先服务训练样本，不服务实时沟通。

### Phase H2.5：ESP32-S3 本地发声原型

目标：

1. ESP32-S3 接 I2S DAC / amp + 小喇叭。
2. 播放本地提示音。
3. 播放预置短句 WAV。
4. 播放最近一次本地录音。
5. App 可通过 BLE command 触发 `play_prompt / replay_last / stop_playback`。

这条线只做本地发声能力，不做实时 TTS 流播放。

### Phase H3：桌面 / 固定工位 companion

目标：

1. 固定工位外接麦、扬声器、脚踏按钮。
2. desktop companion 或 Web/PWA 接收 USB / BLE 事件。
3. 用 LiveKit 正常进房间。
4. 发声由桌面扬声器 / 系统音频输出承担。
5. 记录由桌面麦克风 / LiveKit / recorder queue 承担。
6. 硬件只做控制和设备质量 telemetry。

### Phase H4：再判断是否做完整硬件终端

只有当前面几件事证明真实用户高频需要时，再评估：

1. Raspberry Pi / Linux SBC 直接跑 LiveKit client。
2. Android 小主机或定制手机形态。
3. ESP32-S3 继续只做低功耗 peripheral。

## 5. 第一批购买清单

### 必买：ESP32-S3 开发板

推荐优先买 2 块，避免一块刷坏或焊接出问题时中断开发。

| 选项 | 推荐度 | 用途 | 购买 / 文档 |
|---|---:|---|---|
| Espressif ESP32-S3-DevKitC-1 | P0 | 官方基准板，最适合对照 ESP-IDF 文档 | [官方用户指南](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/) / [官方购买样品入口](https://www.espressif.com/en/company/contact/buy-a-sample) |
| SparkFun Thing Plus ESP32-S3 | P0 | USB-C、LiPo 充电、microSD、Qwiic，适合随身原型 | [产品页](https://www.sparkfun.com/sparkfun-thing-plus-esp32-s3.html) / [Hookup Guide](https://docs.sparkfun.com/SparkFun_Thing_Plus_ESP32-S3/introduction/) |
| Adafruit ESP32-S3 Feather | P1 | Feather 生态、USB-C、LiPo，适合快速堆外设 | [产品指南](https://learn.adafruit.com/adafruit-esp32-s3-feather) / [产品页](https://www.adafruit.com/product/5323) |

默认建议：

1. `ESP32-S3-DevKitC-1` 买 1 块，用来对照官方文档。
2. `SparkFun Thing Plus ESP32-S3` 买 1 块，用来做随身控制桥，因为它自带 LiPo 充电、microSD 和 USB-C。

### 必买：按钮、线材和电源

| 物料 | 数量 | 用途 |
|---|---:|---|
| 面包板 | 1-2 | 免焊原型 |
| 杜邦线 公对公 / 公对母 / 母对母 | 各 1 套 | 连接按钮、I2S 麦克风、LED |
| 轻触按钮 | 5-10 | `capture_start / stop / replay / interrupt` |
| 10k 电阻 | 10 | 按钮上拉 / 下拉备用 |
| USB 数据线 | 2 | 确保是数据线，不是只能充电的线 |
| LiPo 电池，JST 接口 | 1-2 | 只给带充电管理的板使用 |

### P0：发声和记录音频件

| 物料 | 推荐度 | 用途 | 文档 |
|---|---:|---|---|
| Adafruit I2S MEMS Microphone Breakout | P0 | 记录输入；验证 ESP32-S3 I2S 采集 | [产品指南](https://learn.adafruit.com/adafruit-i2s-mems-microphone-breakout) / [产品页](https://www.adafruit.com/product/3421) |
| MAX98357A I2S Amp + 小喇叭 | P0 | 本地提示音、预置短句、最近录音回放 | [产品指南](https://learn.adafruit.com/adafruit-max98357-i2s-class-d-mono-amp) / [产品页](https://www.adafruit.com/product/3006) |
| microSD 卡 | P1 | SparkFun Thing Plus 本地录音缓存 | [SparkFun 硬件概览](https://docs.sparkfun.com/SparkFun_Thing_Plus_ESP32-S3/hardware_overview/) |
| 手机 USB-C 领夹麦 | P0 | 先验证现成外接麦是否比自研麦更稳 | 按手机接口购买 |
| 便携蓝牙音箱 / 有线小音箱 | P0 | 先验证 App 播放 TTS 的发声体验 | 按场景购买 |

注意：

1. I2S 麦克风是数字音频，不是 I2C，也不是模拟麦。
2. Adafruit I2S MEMS 麦克风是低电压设备，按官方指南走 3.3V 逻辑，不要接 5V 逻辑。
3. MAX98357A 是 I2S 输入的功放，不是麦克风；它只能解决本地播放，不解决录音。
4. ESP32-S3 不能当普通蓝牙音箱使用；真实 TTS 外放优先让 App 播放到手机、蓝牙音箱或桌面扬声器。

### 可选：更像产品的外设

| 物料 | 用途 |
|---|---|
| BLE 脚踏 / BLE 按钮 | 验证不用自研板也能触发 capture / interrupt |
| 手机 USB-C 领夹麦 | 先评估收音质量是否比自研 I2S 麦克风更有价值 |
| 便携蓝牙音箱 | 验证陌生人沟通外放场景 |
| 骨传导耳机 | 验证用户自己接收提示，不打扰周围人 |

## 6. 官方文档入口

### 硬件 / 固件

1. Espressif ESP32-S3-DevKitC-1 用户指南  
   https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/
2. ESP-IDF ESP32-S3 Get Started  
   https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/get-started/
3. ESP-IDF BLE Guide  
   https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/ble/index.html
4. ESP-IDF BLE API Reference  
   https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/bluetooth/bt_le.html
5. ESP-IDF ESP32-S3 I2S Reference  
   https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/i2s.html
6. Arduino core for ESP32  
   https://github.com/espressif/arduino-esp32

### App / LiveKit / BLE

1. Expo development builds  
   https://docs.expo.dev/develop/development-builds/introduction/
2. Expo Audio  
   https://docs.expo.dev/versions/latest/sdk/audio/
3. Expo config plugins  
   https://docs.expo.dev/config-plugins/introduction/
4. react-native-ble-plx docs  
   https://dotintent.github.io/react-native-ble-plx/
5. react-native-ble-plx Expo setup  
   https://github.com/dotintent/react-native-ble-plx/wiki/Expo
6. LiveKit React Native quickstart  
   https://docs.livekit.io/transport/sdk-platforms/react-native/
7. LiveKit connect basics  
   https://docs.livekit.io/intro/basics/connect/

## 7. 推荐技术栈

### 固件侧

默认用 ESP-IDF，而不是 Arduino IDE，原因：

1. BLE GATT、Wi-Fi、I2S、NVS、OTA、低功耗以后都会越来越需要系统级控制。
2. 官方文档和示例更贴近生产固件。
3. 后续要做设备协议、telemetry 和可靠重连，ESP-IDF 更稳。

Arduino IDE 可以作为第一天点灯 / 串口验证工具，但不作为仓库长期固件主线。

建议未来目录：

```text
hardware/
  esp32-bridge/
    README.md
    firmware/
      CMakeLists.txt
      main/
        app_main.c
        vox_ble_service.c
        vox_button_input.c
        vox_device_state.c
        vox_i2s_recorder.c
        vox_i2s_playback.c
        vox_audio_store.c
    docs/
      wiring.md
      protocol.md
```

### App 侧

默认在 `apps/mobile-workbench` 加设备层：

```text
apps/mobile-workbench/src/device/
  ble-device-client.ts
  hardware-events.ts
  hardware-event-router.ts
  hardware-telemetry.ts
```

第一版 BLE 依赖建议：

```bash
cd apps/mobile-workbench
npx expo install react-native-ble-plx
```

`react-native-ble-plx` 需要 native code，因此必须走 Expo development build / prebuild；不能指望 Expo Go 直接跑 BLE。

## 8. BLE 控制桥协议

### 8.1 角色

```text
ESP32-S3 = BLE peripheral / GATT server
Mobile Workbench = BLE central / GATT client
```

### 8.2 Service 和 Characteristic

使用项目自定义 UUID，先在文档固定，再写入固件和 App。

```text
Service: VoxFlame Hardware Bridge
UUID: 9f4f0000-6d6f-4a67-9a1f-voxflame0000

Characteristic: device_state
UUID: 9f4f0001-6d6f-4a67-9a1f-voxflame0000
Properties: read, notify

Characteristic: hardware_event
UUID: 9f4f0002-6d6f-4a67-9a1f-voxflame0000
Properties: notify

Characteristic: command
UUID: 9f4f0003-6d6f-4a67-9a1f-voxflame0000
Properties: write

Characteristic: telemetry
UUID: 9f4f0004-6d6f-4a67-9a1f-voxflame0000
Properties: read, notify

Characteristic: audio_control
UUID: 9f4f0005-6d6f-4a67-9a1f-voxflame0000
Properties: write, notify
```

实际实现时 UUID 必须换成合法 UUID。上面的 `voxflame0000` 只是人类可读占位。

### 8.3 hardware_event payload

第一版用 UTF-8 JSON，便于调试；以后再考虑二进制。

```json
{
  "event_id": "evt_20260505_000001",
  "device_id": "esp32s3_dev_001",
  "event_type": "capture_start",
  "sequence": 42,
  "battery_percent": 87,
  "created_at_ms": 1770000000000
}
```

允许的 `event_type`：

```text
capture_start
capture_stop
replay_last
interrupt_tts
quality_mark
play_prompt
stop_playback
```

### 8.4 device_state payload

```json
{
  "device_id": "esp32s3_dev_001",
  "firmware_version": "0.1.0",
  "battery_percent": 87,
  "charging": false,
  "button_count": 4,
  "audio_input": "i2s_mems_mic",
  "audio_output": "i2s_amp_speaker",
  "recording": false,
  "playback": false,
  "last_error": null
}
```

### 8.5 App 映射规则

| 硬件事件 | App 行为 | 安全边界 |
|---|---|---|
| `capture_start` | 如果当前 surface 是 Practice，准备录音；如果是 Communication，请求启动 quick talk | 第一次必须用户确认授权 |
| `capture_stop` | 停止当前录音或结束当前说话 turn | 不自动上传高风险内容，沿现有 upload policy |
| `replay_last` | 播放最近一条本地录音或最近 TTS | App 内可见；硬件只能回放本地音频 |
| `interrupt_tts` | 中断 TTS / assistant playback | 只影响当前 session |
| `quality_mark` | 标记当前收音质量样本 | 不直接改 durable profile |
| `play_prompt` | 播放硬件内置提示音 / 预置短句 | 不把任意模型输出直接写入硬件播放队列 |
| `stop_playback` | 停止硬件本地播放 | 只影响当前播放 |

硬件事件不能直接：

1. 删除云端数据。
2. 改用户画像。
3. 触发付费、分享、公开发布。
4. 绕过登录或授权。

## 9. ESP-IDF 开发手册

### 9.1 安装环境

按 ESP-IDF 官方文档安装。Linux / macOS 常规流程：

```bash
mkdir -p ~/esp
cd ~/esp
git clone -b v5.3.5 --recursive https://github.com/espressif/esp-idf.git
cd ~/esp/esp-idf
./install.sh esp32s3
. ./export.sh
```

中国大陆网络如果下载慢，可按 Espressif 官方提示设置：

```bash
export IDF_GITHUB_ASSETS="dl.espressif.cn/github_assets"
```

### 9.2 验证开发板

```bash
cd ~/esp
cp -r $IDF_PATH/examples/get-started/hello_world .
cd hello_world
idf.py set-target esp32s3
idf.py menuconfig
idf.py -p /dev/ttyUSB0 flash monitor
```

串口名按系统替换：

1. Linux：`/dev/ttyUSB0` 或 `/dev/ttyACM0`
2. macOS：`/dev/cu.*`
3. Windows：`COMx`

如果刷写失败，先确认：

1. USB 线是数据线。
2. 选择的是正确串口。
3. 板子进入 bootloader 模式。
4. 没有其他串口监视器占用设备。

### 9.3 BLE GATT 原型

固件第一版任务：

1. 广播设备名：`VoxFlame Bridge 001`
2. 暴露 `device_state / hardware_event / command / telemetry`
3. 单击按钮发送 `capture_start`
4. 双击按钮发送 `capture_stop`
5. 长按按钮发送 `interrupt_tts`
6. RGB LED 显示状态：
   - 蓝色慢闪：未连接
   - 蓝色常亮：已连接
   - 绿色闪：事件已发送
   - 红色闪：错误

### 9.4 I2S 记录原型

ESP32-S3 支持 I2S 标准模式和 PDM 等模式。第一版建议用 I2S MEMS 麦克风，采集 mono PCM：

```text
sample_rate: 16000
channels: 1
bit_depth: 16
container: wav
max_duration: 10s
```

第一版验收不是音质完美，而是：

1. 能录到可听音频。
2. WAV 文件能被电脑播放。
3. 上传后能进入现有训练样本链。
4. metadata 记录 `device_type = esp32_s3_i2s_proto`。

### 9.5 I2S 发声原型

ESP32-S3 第一版发声只做本地播放：

```text
sample_rate: 16000 or 22050
channels: 1
bit_depth: 16
container: wav
sources:
  - status beep
  - built-in prompt wav
  - replay latest local recording
```

不要在第一版做：

1. App 到 ESP32-S3 的实时 TTS 音频流。
2. ESP32-S3 直接连模型服务生成 TTS。
3. 用 BLE 传大段音频。

如果确实要播放模型生成的长 TTS，第一版让 App 播放；硬件只发送 `interrupt_tts / replay_last / volume_hint` 这类控制事件。

### 9.6 建议接线口径

不同开发板引脚不同，最终以开发板 pinout 为准。示例口径：

```text
I2S mic VIN -> 3V3
I2S mic GND -> GND
I2S mic BCLK -> ESP32-S3 GPIOx
I2S mic WS   -> ESP32-S3 GPIOy
I2S mic DOUT -> ESP32-S3 GPIOz
I2S mic SEL  -> GND or 3V3
```

I2S amp 示例：

```text
MAX98357A VIN  -> 3V3 or 5V, 按模块指南确认
MAX98357A GND  -> GND
MAX98357A BCLK -> ESP32-S3 GPIOa
MAX98357A LRC  -> ESP32-S3 GPIOb
MAX98357A DIN  -> ESP32-S3 GPIOc
MAX98357A SPK+ -> speaker +
MAX98357A SPK- -> speaker -
```

按钮第一版可用内部上拉：

```text
Button one side -> GPIO
Button other side -> GND
GPIO input mode -> pull-up enabled
pressed -> low
```

## 10. Mobile Workbench 接入手册

### 10.1 为什么 BLE 不能用 Expo Go

BLE 依赖 native module。Expo 官方说明里，Expo Go 只内置固定 native libraries；新增 native library 需要 development build。因此硬件开发从一开始就要用 development build。

### 10.2 App 侧实现步骤

1. 安装 BLE 依赖。
2. 在 app config 加 `react-native-ble-plx` plugin。
3. 生成 development build。
4. 新增 `src/device/ble-device-client.ts`。
5. 扫描 service UUID。
6. 连接设备。
7. discover services and characteristics。
8. monitor `hardware_event`。
9. 把事件交给 `hardware-event-router.ts`。
10. router 显式调用 practice / communication surface 的现有 action。
11. 对发声类事件，App 决定是自己播放 TTS，还是让硬件播放本地提示音。
12. 对记录类事件，App 决定是调用 native recorder queue，还是认领硬件本地录音。

### 10.3 App 权限

Android 12+ 需要关注：

1. `BLUETOOTH_SCAN`
2. `BLUETOOTH_CONNECT`
3. 是否需要 `ACCESS_FINE_LOCATION`
4. 如果声明 `neverForLocation`，必须确认不会用 BLE scan 推断位置。

iOS 需要：

1. `NSBluetoothAlwaysUsageDescription`
2. 如做后台 BLE，需要额外 background mode；第一版不建议后台 BLE 常驻。

### 10.4 LiveKit 边界

LiveKit 仍只在 App / Web / desktop companion 上运行：

```text
hardware_event.capture_start
  -> App UI state
  -> backend /api/rtc/session/start
  -> LiveKit serverUrl + participantToken
  -> @livekit/react-native AudioSession
  -> LiveKit room
```

App 不能把以下内容交给硬件：

1. LiveKit API secret
2. Supabase service role key
3. DashScope / model provider key
4. 用户 access token

ESP32 只持有：

1. 设备 ID
2. 固件版本
3. BLE service UUID
4. 可轮换的配对 token，后续再做

## 11. 上传链路边界

ESP32 录音上传不要新增第二套训练样本事实源。

目标链路：

```text
ESP32-S3 local wav
  -> Wi-Fi upload request
  -> backend upload sign / complete
  -> OSS object
  -> upload receipt
  -> manifest
  -> voice_contributions
```

metadata 至少包含：

```json
{
  "source_surface": "hardware_bridge",
  "device_type": "esp32_s3_i2s_proto",
  "device_id": "esp32s3_dev_001",
  "audio_format": "audio/wav",
  "sample_rate": 16000,
  "channels": 1,
  "collection_mode": "practice",
  "consent_scope": "training"
}
```

如果没有用户登录态，不允许硬件自己上传到用户账户。第一版可以让 App 拿到本地文件后代上传，或者让硬件只上传到一个需要 App 确认认领的 staging endpoint。不要把用户 token 写入固件。

## 12. 安全与隐私规则

1. 硬件上电不自动录音。
2. 硬件开始录音必须有明显 LED 状态。
3. 硬件发声必须可被用户立刻停止。
4. 硬件播放陌生人可听内容前，App 必须能显示或确认要播放的文本 / 来源。
5. App 必须显示当前硬件连接状态。
6. App 必须能断开设备。
7. App 必须能忽略硬件事件。
8. 固件日志不输出用户文本、token、音频内容。
9. 硬件事件只进入 session-local action；durable write 仍经 backend policy。
10. 后台录音第一版不做；如果以后做，必须有系统通知或明显设备指示。

## 13. 验收清单

### H1 BLE 控制桥验收

1. ESP32-S3 可被手机扫描到。
2. App 可连接、断开、重连。
3. App 能收到 `capture_start / capture_stop / interrupt_tts`。
4. 设备断连时 App 显示断连。
5. 事件重复发送不会造成重复上传。
6. `bash scripts/check_ai_docs.sh` 通过。

### H2 I2S 记录验收

1. ESP32-S3 能录制 16k mono WAV。
2. 本地播放可听。
3. 10 秒以内样本稳定保存。
4. 上传后 backend 返回 upload receipt。
5. OSS object、manifest、voice contribution 能对上。
6. metadata 记录硬件来源。

### H2.5 I2S 发声验收

1. ESP32-S3 能通过 MAX98357A 播放本地提示音。
2. 能播放 3 条预置短句 WAV。
3. 能回放最近一次本地录音。
4. App 能发送 `play_prompt / stop_playback / replay_last`。
5. 播放中断不影响 recorder queue 和 LiveKit session 状态。

### H3 LiveKit 联动验收

1. 硬件按键触发 App 请求 session。
2. App 仍通过 backend 拿 LiveKit token。
3. App 启动 LiveKit React Native `AudioSession`。
4. 不把 token / API secret 输出到日志。
5. 中断、断网、设备断连都有 UI 状态。

## 14. 第一周任务建议

1. 买齐 `ESP32-S3-DevKitC-1 + SparkFun Thing Plus ESP32-S3 + 按钮线材 + I2S 麦克风 + MAX98357A + 小喇叭 + USB-C 领夹麦 + 便携蓝牙音箱`。
2. 用 ESP-IDF 跑通 `hello_world`。
3. 用 ESP-IDF 跑通 BLE GATT server 示例。
4. 固定 VoxFlame BLE service / characteristic UUID。
5. 在 `apps/mobile-workbench` 接 `react-native-ble-plx` development build。
6. App 扫描并显示 `VoxFlame Bridge 001`。
7. 单按钮触发 `capture_start`，App 只显示事件，不先控制录音。
8. ESP32-S3 播放本地提示音，验证小喇叭音量和失真。
9. ESP32-S3 录制 3-10 秒 WAV，电脑播放确认可听。
10. 再把 `capture_start / capture_stop` 映射到 native recorder queue。
11. 最后把 `replay_last / interrupt_tts` 映射到 App 或硬件本地播放。

## 15. 后续文档拆分

当开始写固件代码后，再拆出：

1. `hardware/esp32-bridge/README.md`
2. `hardware/esp32-bridge/docs/protocol.md`
3. `hardware/esp32-bridge/docs/wiring.md`
4. `hardware/esp32-bridge/docs/verification.md`

根 README 和产品 PRD 只保留路线入口，不堆具体接线和固件步骤。
