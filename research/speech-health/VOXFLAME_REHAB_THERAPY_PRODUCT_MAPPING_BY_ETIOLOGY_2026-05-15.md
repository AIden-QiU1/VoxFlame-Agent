# VoxFlame 分病因疗法锚点与产品化边界（代码对齐版，2026-05-26）

> 本文不再维护“逐病因大而全功能清单”。
>
> 已完成的通用训练页、评估筛查、病因标签、麦克风质量 metadata、自定义材料切句训练和训练语料整理，不再放在本文作为下一步计划。本文只保留正式疗法 / 理论锚点、专家边界，以及它们如何进入 VoxFlame 的沟通和训练产品。

## 1. 当前判断

Voiceitt 更像 VoxFlame 当前最适合的对标：它解决的不是“做一个训练 App”，而是把个体化语音识别、发声、听写、短语和跨场景输出做成一个 personalized speech access layer。

ReTalk / 复言对 VoxFlame 的启发是另一层：康复训练要尊重专家知识，形成 `专家评估 -> 软件高频训练 -> AI 分析 -> 专家复核 -> 专家知识自动化` 的闭环。

因此 VoxFlame 的短期优先级是：

1. 先把沟通页做成长期可用的真实工具。
2. 再把训练页做成稳定采样和低风险练习工具。
3. 最后在专家边界清楚时，把正式疗法做成协议化任务。

固定句库只是缓兵之计。真正长期有用的是：不同场景的沟通策略、可展示 / 可外放的表达、用户自己的准备材料、能被复查的训练进步。

第一句话 / 破冰材料库也不应只是人工造句。它更应该成为实时沟通链路的第一轮协议：先教对方怎么听、保护用户表达权、建立没听清时的补救规则，再把场景目标交给沟通转写 agent。它可以借鉴 supported conversation、communication partner training、AAC self-advocacy、conversation repair 和 Speech Systems / Intelligibility strategy，而不是只按“常用句”分类。

## 2. 已经由代码承接的部分

这些能力已经在代码中有现役实现，不再作为本文未来计划重复展开：

1. **基础沟通工作台**
   - `frontend/src/components/chat/ChatInterface.tsx`
   - LiveKit 连接、语音输入、文本输入、字幕辅助、表达工具箱、starter kit、workspace loadout。
2. **基础训练工作台**
   - `/contribute` 主题选择。
   - `/contribute/topic/[topicId]` 录音训练。
   - 20 词评估筛查、通用句库、自定义材料切句训练。
3. **训练样本 contract**
   - 上传 metadata 已含 `target_text / recognized_text / prompt_fingerprint / confidence / audio quality / etiology / severity` 等字段。
4. **麦克风设置与收音质量**
   - `/settings/audio`
   - 首选麦克风、输入设备 metadata、RMS / peak / 静音比例。
5. **准备材料和高频表达**
   - 多份自定义材料库。
   - 快捷短语 / 表达工具箱。
   - 场景和热词模板。
6. **Mobile Workbench skeleton**
   - `communication / practice / memory / device` 四个 surface 已有雏形。

## 3. 还没有完成的关键产品面

1. **沟通页 confirmed output 呈现层**
   - 现有沟通页能实时理解语音，但还没有把同一个沟通转写 agent 的结果稳定送到多个出口。
   - 缺少确认文本缓冲、大字展示、反转、复制、文本发声和硬件外放状态。
2. **listener-facing 出口**
   - 沟通页还不是给对方看的界面。
   - 缺少确认后展示、面对面反转和外放控制。
4. **训练总结和长期记忆分离**
   - 当前 training summary 仍可能进入 workspace snapshot 和沟通上下文。
   - 下一步应移出长期记忆，只留在训练页 / dataset review / 专家复核。
5. **专家协作协议**
   - 现在训练页只有低风险通用训练，还没有治疗师配置、专家复核和病因机制化 protocol。

## 4. 最值得保留的正式疗法 / 理论锚点

### 4.1 MIT / MUSTIM：中风后非流利性失语的音乐化语言启动

正式名称：

- Melodic Intonation Therapy，旋律发音治疗，MIT。
- Musical Speech Stimulation，音乐语言刺激，MUSTIM，属于 Neurologic Music Therapy 技术体系。

适合产品化的位置：

1. 不是默认自助训练按钮。
2. 应由专家选择目标短句、提示层级和安全边界。
3. 软件负责节拍、旋律、跟读、补全、提示递减和记录。
4. 成功短句可以迁移到沟通页，用于大字展示或外放。

AI 可自动化：

1. 记录启动延迟、目标短句覆盖率、节奏对齐、提示层级。
2. 归纳哪些短句在减少音乐支架后仍能说出。
3. 给专家生成复核材料。

边界：

不能宣称替代言语治疗师或音乐治疗师；不能让用户自己随便点“音乐治疗”。

### 4.2 LSVT LOUD 启发的响度校准：帕金森沟通可听见训练

正式名称：

- Lee Silverman Voice Treatment LOUD，LSVT LOUD。

适合产品化的位置：

1. VoxFlame 可以做“响度校准助手 / 沟通可听见训练”。
2. 实时显示响度、句尾衰减、持续发声和功能句达标情况。
3. 沟通页可提示“这句对方可能听不清”，并提供外放 / 大字展示 / 重说建议。

AI 可自动化：

1. 响度、句尾衰减、发声时长、语速。
2. 功能句达标率。
3. 沟通页听众确认反馈。

边界：

不要未经授权写“VoxFlame 提供 LSVT LOUD”。训练强度和嗓音安全需要治疗师确认。

### 4.3 Voice Banking / Message Banking：ALS / MND 的表达保全

正式名称：

- Voice Banking，声音银行。
- Message Banking，信息银行 / 消息银行。
- AAC Pathway，辅助与替代沟通路径。

适合产品化的位置：

1. 这是 VoxFlame 记忆页、TTS 页、硬件外放和沟通页最天然的结合点。
2. 优先保留姓名、家人称呼、求助语、情绪表达、医疗决定、个人风格表达。
3. 随病程从实时语音切换到文字、短语、合成语音、硬件外放。

AI 可自动化：

1. 录音覆盖率和质量检查。
2. 重要人物 / 场景覆盖检查。
3. 推荐还没保存但高价值的 message。

边界：

这不是康复训练，而是表达自主权保全。必须处理授权、家属访问、声音克隆同意、数据导出和删除。

### 4.4 PECS：孤独症和复杂沟通需求的图片交换沟通系统

正式名称：

- Picture Exchange Communication System，图片交换沟通系统，PECS。

适合产品化的位置：

1. 更适合 App / 平板 / 家庭和学校场景。
2. 不等于“放几张图片按钮”。
3. 应按阶段承接：主动交换、距离、坚持、辨别、句条组合、回应问题。

AI 可自动化：

1. 主动发起次数。
2. 提示层级。
3. 图片辨别正确率。
4. 句条长度和泛化场景。

边界：

儿童和孤独症用户必须有家长、老师或专业人员参与；不能把目标写成“纠正社交差异”。

### 4.5 Speech Intelligibility Treatment / Speech Systems Approach：脑瘫构音障碍的可懂度训练

正式名称：

- Speech Intelligibility Treatment，言语可懂度治疗。
- Speech Systems Approach，言语系统路径。

适合产品化的位置：

1. 最贴近 VoxFlame 北极星：陌生人能否听懂。
2. 关注呼吸、响度、语速、短语长度、重音和停顿的系统策略。
3. 可和沟通页打通：系统确认是否听懂，听众确认是否听懂，有效策略写回沟通页。

AI 可自动化：

1. 语速、响度、短语长度、停顿位置。
2. 目标词覆盖率。
3. 听众理解率和用户体力负担。

边界：

不要包装成“脑瘫治愈训练”。目标是沟通参与和被理解。

## 5. 下一步执行计划

### P0：先把沟通面做实

1. 保持实时沟通链路为唯一主干：用户语音 / 文本输入 -> 沟通转写 agent -> confirmed output。
2. `给对方看`出口支持确认文本、大字展示和反转。
3. `文本发声 / 硬件`出口把 confirmed output 送到现有 TTS 代播链路，并预留硬件输出 metadata。
4. `听写复制`出口支持复制、清空、第三方粘贴和显式保存为短语或准备材料。
5. 所有出口共用同一个沟通转写 agent，不新增第二条沟通主链。

验收信号：

1. 用户能在面对面场景中把确认后的文字给对方看。
2. 用户能把文字直接外放。
3. 用户能把同一条 confirmed output 复制到第三方输入场景。
4. 不需要先进入训练页，也不需要切到第二个 agent，就能完成一次真实沟通。

### P1：训练总结退出长期记忆

1. 训练总结留在训练页、dataset review 和专家复核材料。
2. 沟通页默认上下文只带用户画像、准备材料、场景模板、短语和热词。
3. 训练总结不得默认写入 `communication_loadout`。

验收信号：

1. 沟通页“本次上下文”不再显示训练总结。
2. workspace snapshot 仍可供训练页读取 training reports。
3. 记忆页不把训练总结当作长期对象展示。

### P2：Voice / Message Banking 最小版

1. 在记忆页或 TTS 页新增“表达保全”入口。
2. 先录制 / 保存 20 条高价值 message：
   - 身份
   - 求助
   - 家人称呼
   - 医疗决定
   - 情绪表达
   - 沟通偏好
3. 支持原声回放、文本外放和导出。

验收信号：

1. 每条 message 有授权、用途和删除入口。
2. 可进入沟通页或硬件外放候选。
3. 不与训练样本混线。

### P3：专家协作训练 protocol v0

1. 先做三类低风险协议：
   - 响度校准。
   - 可懂度策略训练。
   - 自定义材料高频句复练。
2. 专家配置：
   - 目标机制。
   - 适用 / 不适用人群。
   - 训练强度。
   - 复核频率。
   - 安全文案。
3. AI 只做记录、分析和建议，不做临床诊断。

验收信号：

1. 每个训练样本带 protocol id。
2. 报告明确“系统识别代理指标”，不写康复疗效。
3. 没有专家配置时不开放正式疗法按钮。

## 6. 参考资料

1. ASHA Aphasia：MIT 作为失语症表达治疗方法  
   https://www.asha.org/practice-portal/clinical-topics/aphasia/
2. Academy of Neurologic Music Therapy：MUSTIM 标准化技术  
   https://nmtacademy.co/nmt-system-of-standardized-techniques/
3. Parkinson’s Foundation：LSVT LOUD  
   https://www.parkinson.org/understanding-parkinsons/non-movement-symptoms/speech-swallowing
4. ALS Association：Voice Banking / Message Banking  
   https://www.als.org/navigating-als/resources/fyi-voice-preservation
5. ASHA AAC：PECS 与 AAC  
   https://www.asha.org/practice-portal/professional-issues/augmentative-and-alternative-communication/
6. NCBI Bookshelf：脑瘫言语可懂度改善证据  
   https://www.ncbi.nlm.nih.gov/books/NBK533237/
