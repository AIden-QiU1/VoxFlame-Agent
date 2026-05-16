# Voiceitt 功能设置深度分析与 VoxFlame 启发（2026-05-15）

> 本文分析 Voiceitt 公开资料、帮助文档和用户可见设置。目标不是照搬功能，而是理解它为什么这样组织，再判断 VoxFlame 现在的 Web / App / 训练 / 沟通链路应该吸收什么。

## 1. 一句话判断

Voiceitt 的产品不是“一个语音识别输入框”，而是一个围绕非标准语音用户搭建的 **personalized speech access layer**：

```text
Record / train unique speech
  -> Speak: speech-to-speech for in-person and smart assistants
  -> Dictate: speech-to-text for long text and screen sharing
  -> Integrations: captions / Chrome / meeting platforms
  -> Settings: voice, pause tolerance, mic, display, profanity, profile, account
```

它的关键设计不是某个开关，而是把用户的非标准语音变成三类可复用输出：

1. **标准化语音输出**：让别人或智能设备听见。
2. **标准化文本输出**：让别人读、复制、粘贴、分享。
3. **跨平台字幕 / 输入**：让会议、浏览器、课堂和办公系统可访问。

对 VoxFlame 的启发是：我们不应该只做一个“实时翻译器”，而要做一个更稳定的 **沟通工作台 + 训练数据闭环 + 可复用表达层**。但当前阶段也不能贪多，必须优先把实际影响沟通成功率的设置打通到真实链路。

## 2. Voiceitt 的功能系统

### 2.1 Record / Training：先教系统听懂我

Voiceitt 要求用户先录 phrase cards。公开 FAQ 说明：初始至少 50 条录音，之后可继续通过更高 level 增加录音，个人识别会随训练和使用继续改善。训练 phrase set 有不同难度，官方公开资料中列出过 `Short / Medium / Default / Simple Language` 等不同长度层级。

这说明 Voiceitt 的第一原则是：

> 不是要求用户适应通用 ASR，而是让 ASR 适应用户的个人语音模式。

训练设计里还有几个细节值得注意：

1. 允许跳过当前 phrase。
2. 允许回听自己的录音。
3. 允许重录。
4. 要求安静环境、自然发音、避免他人说话。
5. 训练后还可以添加 personal vocabulary 和 shortcut phrases。

**对 VoxFlame 的启发**

我们已经有 `target_text -> recording envelope -> upload receipt -> manifest`，方向是对的。但 Voiceitt 提醒我们：训练不是一次性“数据采集”，而是持续让系统建立个人识别能力。

VoxFlame 应该继续强化：

1. 训练 level / progress 不要只是数量，应绑定“系统听懂稳定度”。
2. 训练句池要分难度：短词、短句、功能句、自定义材料、真实场景。
3. 每条训练样本要可回听、可重录、可不收录。
4. 低质量音频不该被硬塞进高置信数据集。
5. 用户自定义词汇、名字、地点、专业词，应成为独立 profile 资产，而不是散在 transcript 里。

### 2.2 Speak：把用户语音转成清晰语音

Voiceitt 的 Speak 是 speech-to-speech：用户说短 phrase，系统识别后用合成语音播放出来。它也支持选择输出 voice、调节播放速度，并可切到 ChatGPT 对话。

Speak 的真实用户任务不是“转写”，而是：

1. 面对面沟通时，替用户把内容说清楚。
2. 和智能音箱 / 智能家居交互。
3. 在用户口语不稳定时，用标准化声音完成指令。

**对 VoxFlame 的启发**

VoxFlame 沟通页当前重点是 LiveKit 实时理解和纠错。下一步不应只加聊天 UI，而应把 `Speak` 拆成几个可验证能力：

1. **短句确认后外放**：用户说一句，系统展示候选，让用户确认，再 TTS 外放。
2. **一键重播 / 改写 / 换短句**：真实沟通里比长聊天更重要。
3. **准备短语直接发声**：prepared expression 不只是训练材料，也应该能直接播放。
4. **输出声音设置**：voice、速度、音量、是否自动播放，应是沟通设置的一部分。

但要注意：Voiceitt 的 Speak 更偏“系统复述用户原话”。VoxFlame 的差异可以是“纠错 + 意图确认”：当 ASR 不稳定时，先帮助用户和听众确认真实意图，而不是立刻播放可能错误的句子。

### 2.3 Dictate：把用户语音转成可编辑文本

Voiceitt 的 Dictate 是 speech-to-text：用于长文本、邮件、笔记、文档。它支持：

1. 持续听，直到用户停止。
2. 手动编辑文本。
3. Notes 返回历史 dictation。
4. punctuation 口述。
5. voice commands：stop listening、new paragraph、new line、undo、copy。
6. keyboard shortcuts。
7. copy / share 到其他平台。
8. play aloud。
9. clear。
10. flip text 给面对面的听众看。

这是一套非常完整的“文本工作台”，不是单纯字幕。

**对 VoxFlame 的启发**

我们不应该马上做完整 Dictate 套件，但要看到它背后的结构：

```text
speech input
  -> editable text buffer
  -> note/history
  -> copy/share/play/clear
  -> listener-facing display
```

VoxFlame 当前可借鉴的最小路径：

1. 在沟通页维护一个“当前可展示文本 buffer”，不是只显示聊天消息。
2. 支持用户改字后再播放或展示。
3. 支持“给对方看”大字模式。
4. 支持最近几条 notes，便于回到上一句。
5. 将 partial transcript 和 final/confirmed transcript 明确分开。

不要马上照搬 voice commands。Voice commands 对非标准语音用户反而可能制造二次识别负担。VoxFlame 更适合先做实体按钮、快捷键、短语卡和大按钮。

### 2.4 Integrations：把个性化识别带到外部平台

Voiceitt 的 Integrations 包括会议 caption、Zoom / Teams / WebEx、Chrome extension、Google Workspace / Classroom、Microsoft 365 Online 等。FAQ 还说明部分平台限制，例如 Chrome extension 不适用于移动设备，Captions 是否进入会议 transcript 也有限制。

这说明 Voiceitt 的战略是：

> 用户真正要沟通的地方不在 Voiceitt app 内，而在会议、课堂、办公、智能设备和浏览器里。

**对 VoxFlame 的启发**

VoxFlame 现在不应急着做 Chrome extension 或会议插件，但要从 day one 设计可迁移输出：

1. `recognized_text / corrected_text / confirmed_text` 要有清晰 schema。
2. 输出目标要分：屏幕展示、TTS 外放、复制、分享、字幕流、外部控制。
3. prepared expression / hotword / user profile 要能被 runtime session 读取，也能被未来插件读取。
4. 后续 Integrations 不应该绕开 backend owner；外部平台只拿最小必要 token 和 session output。

## 3. Voiceitt 设置项深度分析

### 3.1 Voice output

Voiceitt 允许用户换合成语音。它解决的是“我希望系统替我说话时，听起来更舒服、更像我想呈现的自己”。

**VoxFlame 思考**

对构音障碍用户，TTS voice 不是装饰，而是身份表达。我们后续需要把 voice output 放进沟通设置，但必须避免一开始堆很多 voice picker。最小可行版本：

1. 语速。
2. 音量。
3. 是否自动播放。
4. 语音风格一两个稳定选项。

### 3.2 Silence timeout

Voiceitt 允许在 Speak mode 调整 silence timeout，尤其适合需要在词之间呼吸、组织语言或暂停的用户。

这是非常关键的设置。它本质上不是“技术参数”，而是对用户说话节奏的尊重。

**VoxFlame 思考**

VoxFlame 当前训练和 LiveKit 会话已经有短词 / speech activity 相关逻辑，但还没有用户可见的 pause tolerance。我们应该把它产品化为：

1. `我需要更多停顿时间`
2. `正常`
3. `快速响应`

底层再映射到 VAD / endpointing / final transcript 等参数。不要把用户暴露给 `timeout_ms` 这种工程词。

### 3.3 Voice playback speed

Voiceitt 允许调节朗读速度。它对应两个场景：

1. 用户自己回听是否正确。
2. 听众是否能轻松理解。

**VoxFlame 思考**

VoxFlame 的 TTS 速度设置应该和“给对方听”绑定，而不是藏在通用设置里。特别是医疗、陌生人求助、工作场景，慢一点、清楚一点，比自然速度更重要。

### 3.4 Bluetooth microphone / Preferred microphone

Voiceitt 设置里可启用蓝牙麦克风并选择 preferred microphone，但公开说明也提醒：这里只能改输入设备，不能改输出设备。

**VoxFlame 当前已吸收**

我们已经做了 `/settings/audio`：

1. 授权麦克风。
2. 列出输入设备。
3. 保存首选麦克风。
4. 现场收音测试。
5. Web 沟通页和训练页会读取同一个设置。
6. 训练样本 metadata 会记录输入设备和音频质量。

**下一步思考**

还缺两个真实设备验证：

1. 蓝牙耳机 / USB 麦克风 / 远程虚拟声卡切换 smoke。
2. 移动端真机麦克风与蓝牙设备策略。

### 3.5 Record validation / too short error

截图里 Voiceitt 提供 “Disable too short error”。它的意义不是鼓励低质量数据，而是防止部分用户因为发声短、停顿长、声音弱而被系统挡在门外。

**VoxFlame 当前已吸收**

我们已经把“过短/低质量”从纯阻塞改成质量分级：

1. `high_confidence`
2. `review`
3. `low_confidence`

低质量样本可以保留为 attempt / 回看，不进入高置信训练判断。

**产品原则**

不要对用户说“你录错了”。应该说：

1. “这条已经留下来了。”
2. “它更适合当作一次尝试。”
3. “如果想让系统学得更稳，可以补一条。”

### 3.6 Profanity allowed

Voiceitt 允许用户决定是否识别 profanity。它本质上是内容过滤和身份表达边界。

**VoxFlame 思考**

VoxFlame 不能替用户净化表达。构音障碍用户最怕的是系统把自己的真实意图改掉。更合理的设置不是“禁脏话”，而是：

1. 原始识别保留。
2. 对外展示/朗读可选择“公共场合柔和显示”。
3. 所有改写必须可见、可撤回。

### 3.7 Flip text

Voiceitt 的 flip text 用于手机面对面沟通，让对面的人能读屏幕。

**VoxFlame 强启发**

这是高价值低复杂度功能。VoxFlame App 应该做：

1. 大字给对方看。
2. 横屏 / 反向显示。
3. 一键朗读。
4. 显示最近一句 confirmed text。
5. 可快速切回用户编辑模式。

这比很多复杂 AI 功能更接近真实沟通成功率。

### 3.8 Highlight the words

Voiceitt 在朗读 dictated text 时可高亮当前朗读词，但受 voice 类型限制。

**VoxFlame 思考**

高亮不是装饰，而是“听觉 + 视觉同步确认”。适合：

1. 用户回听训练录音对应文本。
2. TTS 外放时让听众看到读到哪里。
3. prepared expression 长句播放。

但它依赖 TTS word boundary 或近似进度，第一阶段不必强求精确词级时间戳。可以先做句级/短语级高亮。

### 3.9 Streaming mode

截图里 Voiceitt 有 “Streaming mode: Responses arrive in real time”。这说明它允许实时增量显示，而不是等最终结果。

**VoxFlame 思考**

Streaming 对沟通速度有价值，但对非标准语音也有风险：

1. partial 错字会误导听众。
2. 文本跳动会增加压力。
3. 用户可能来不及修正，系统已经“替他说了”。

VoxFlame 应支持两个显示策略：

1. **实时预览**：只给用户看，低延迟。
2. **确认后展示/朗读**：给听众看或 TTS 外放。

### 3.10 Shortcut phrases

Voiceitt 的 shortcut phrases 允许用户说一个短词，让系统输出一整句。官方例子是说 “Burger”，系统说完整点餐句。

**VoxFlame 强启发**

这和我们的 prepared expression / important expression 高度一致。应作为下一阶段重点：

1. 用户说短触发词。
2. 系统输出长表达。
3. 支持场景绑定：医院、工作、家人、陌生人。
4. 支持冲突检测：触发词不能太泛。
5. 支持听众确认：短触发词识别不稳时先展示候选。

它比“让模型自由生成更聪明”更可靠。

### 3.11 Personal vocabulary

Voiceitt 允许用户添加人名、地名、常用词。它解决的是通用模型最容易错的 proper nouns 和个人生活词。

**VoxFlame 思考**

VoxFlame 应把 personal vocabulary 独立成 durable asset，而不是只放 prompt：

```text
personal_vocabulary:
  phrase
  pronunciation_hint
  category: person | place | device | medical | work | custom
  example_context
  recording_refs
  last_confirmed_at
```

后续它应进入：

1. ASR hotword / biasing。
2. 训练句生成。
3. 沟通页候选纠错。
4. prepared expression。

### 3.12 Voice commands / keyboard shortcuts / switch access

Voiceitt 同时提供 voice commands、keyboard shortcuts、switch access 思路。它不是为了炫技，而是因为目标用户可能鼠标操作困难、触屏精细动作困难、或需要 hands-free。

**VoxFlame 思考**

我们不应一上来做完整 voice control。更稳的路线：

1. Web：键盘快捷键。
2. App：大按钮、长按、实体按钮/耳机按钮。
3. 硬件：BLE button event。
4. Voice command：只对极少数高置信命令开放，例如停止、重播。

### 3.13 Notes / history

Voiceitt Dictate 保存 notes，可以返回之前消息继续修改。

**VoxFlame 思考**

VoxFlame 目前 memory/workspace 是长期事实源，但沟通页还需要一个轻量 session history：

1. 最近说过的 confirmed text。
2. 最近外放的句子。
3. 最近被系统听错的 risky terms。
4. 一键复用 / 改写 / 训练。

这能把沟通页、训练页和记忆页真正串起来。

### 3.14 Account / data deletion

Voiceitt 设置里有 delete account，并说明会删除录音和数据且不可逆。

**VoxFlame 思考**

这对我们很重要。VoxFlame 未来必须提供：

1. 删除账户。
2. 删除训练录音。
3. 删除 prepared expression / personal vocabulary。
4. 导出自己的训练数据和沟通档案。
5. 明确哪些是本地 cache，哪些是 backend durable owner，哪些在 OSS。

## 4. 和 VoxFlame 当前功能的对照

| 能力 | Voiceitt | VoxFlame 当前状态 | 判断 |
|---|---|---|---|
| 个人语音训练 | 50+ recordings，level，持续更新 | Web 训练样本、App recorder queue、upload receipt | 方向正确，需更清晰 progress / profile |
| Speak speech-to-speech | 短句识别后 TTS 说出 | LiveKit 沟通 + TTS runtime 基础 | 应做确认后外放和 prepared expression 发声 |
| Dictate speech-to-text | 长文本、notes、copy/share/play/clear | 沟通页 transcript / message，还不是文本工作台 | 不急全做，先做 confirmed text buffer |
| Integrations | Captions、Chrome、会议平台 | 暂无插件，主链 Web/App | 暂不做，但 schema 要预留 |
| 麦克风设置 | preferred microphone | 已新增 `/settings/audio` 并打通 Web | 需真实设备 smoke |
| Silence timeout | 用户可调 | 内部有 endpointing / short mode，但未产品化 | 应做成“停顿时间”设置 |
| Too short validation | 可关闭 too short error | 已做质量分级 | 路线优于简单关闭 |
| Personal vocabulary | 可添加常用词 | hotword/profile 雏形分散 | 应统一 durable asset |
| Shortcut phrases | 短触发词输出长句 | prepared expression 可承接 | 高优先级 |
| Flip text | 面对面读屏 | 暂未做 | App 高优先级 |
| Highlight words | TTS 同步高亮 | 暂未做 | 中优先级，先句级 |
| Profanity | 用户决定是否识别 | 暂未做 | 后续做 display policy，不改原文 |
| Notes/history | Dictation history | session memory / workspace 但沟通页轻 history 不足 | 应补 session-local recent outputs |

## 5. VoxFlame 应该学什么，不学什么

### 5.1 应该学

1. **设置必须影响真实链路**  
   Voiceitt 的麦克风、silence timeout、voice、playback speed 都直接影响沟通行为。VoxFlame 设置页也必须只放这种真实设置。

2. **三种输出面分开**  
   Speak 给别人听；Dictate 给别人读/复制；Integrations 给外部平台用。VoxFlame 也应区分：TTS 外放、屏幕展示、复制分享、字幕流、训练数据。

3. **个人语音 profile 是中心资产**  
   训练不是活动页功能，而是整个产品的理解能力来源。

4. **shortcut phrases 是强产品能力**  
   对发声成本高的用户，短触发词换长表达，比自由聊天更可靠。

5. **面对面沟通需要 listener-facing UI**  
   flip text、大字、朗读、高亮，都是为沟通伙伴设计的，不是为系统设计的。

### 5.2 不应该照搬

1. **不要把 Voiceitt 的模式名称原样搬过来**  
   VoxFlame 的用户可能不需要理解 Speak / Dictate / Integrations。我们可以用中文任务语言：`说给对方听`、`写成文字`、`给对方看`、`练习这句话`。

2. **不要先做 Chrome extension / meeting plugin**  
   现在主链还在 Web/App 稳定期，先把 backend-owned contract、confirmed text、TTS、prepared expression 打稳。

3. **不要把 voice commands 当默认答案**  
   非标准语音用户用语音命令控制语音产品，可能形成二次失败。实体按钮、快捷键、大按钮、BLE 控制更稳。

4. **不要把训练 level 做成纯数量 gamification**  
   数量有用，但 VoxFlame 应更重视“真实沟通是否更稳”和“系统听错是否减少”。

## 6. 建议路线

### P0：已经开始做，继续打稳

1. 音频设置只保留真实麦克风设置和收音测试。
2. 训练样本带音频质量和设备 metadata。
3. 低质量样本保留为 attempt，不进高置信训练。
4. 沟通页继续用 LiveKit 主链，不恢复旧 websocket/TEN/Agora。

### P1：最值得做的下一个功能切片

1. **停顿时间设置**  
   任务语言：`我需要更多停顿时间` / `正常` / `快速响应`。  
   打通训练和沟通 endpointing。

2. **给对方看模式**  
   App 优先：大字、横屏、最近确认句、一键朗读。

3. **confirmed text buffer**  
   区分实时预览、最终识别、用户确认文本。只有 confirmed text 才适合外放、记忆或分享。

4. **prepared expression 发声**  
   记忆页/沟通页的 prepared expression 可以直接 TTS 播放。

### P2：构建个人表达资产

1. personal vocabulary。
2. shortcut phrases。
3. risky terms / fallback phrase。
4. 场景模板：医院、工作、陌生人、家人。
5. 冲突检测和用户确认。

### P3：外部平台与生态

1. 字幕输出 API。
2. 浏览器扩展。
3. 会议插件。
4. 智能家居 / 外部控制。

这些必须等内部 confirmed text / privacy / token / output schema 稳定后再做。

## 7. 参考资料

1. Voiceitt 官方首页：`https://www.voiceitt.com/?lang=en`
2. Voiceitt Help: What is Voiceitt?  
   `https://help.voiceitt.com/what-is-voiceitt`
3. Voiceitt Help: Voiceitt settings  
   `https://help.voiceitt.com/voiceitt-settings`
4. Voiceitt Help: Dictate mode  
   `https://help.voiceitt.com/dictate-mode`
5. Voiceitt FAQ  
   `https://www.voiceitt.com/faq`
6. Voiceitt Help: Record your speech  
   `https://help.voiceitt.com/record-your-speach`
7. Voiceitt Help: Voiceitt record mode (training)  
   `https://help.voiceitt.com/voiceitt-record-mode-training`
8. Voiceitt Help: Use Voiceitt with OpenAI  
   `https://help.voiceitt.com/use-voiceitt-with-open-ai`
