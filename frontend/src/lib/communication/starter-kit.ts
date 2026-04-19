export interface StarterKitSource {
  id: string
  label: string
  url: string
}

export interface StarterKitPhrase {
  id: string
  text: string
  note: string
  sourceIds: string[]
}

export interface StarterKitPhraseGroup {
  id: 'opening' | 'core' | 'repair' | 'partner' | 'switch'
  title: string
  description: string
  phrases: StarterKitPhrase[]
}

export interface StarterKitScene {
  id: 'interview' | 'workplace' | 'stranger' | 'medical' | 'caregiver' | 'emergency'
  title: string
  icon: string
  description: string
  rationale: string
  focusPoints: string[]
  sections: StarterKitPhraseGroup[]
}

export const STARTER_KIT_SOURCES: StarterKitSource[] = [
  {
    id: 'asha-aac',
    label: 'ASHA AAC',
    url: 'https://www.asha.org/public/speech/disorders/aac/',
  },
  {
    id: 'asha-dysarthria',
    label: 'ASHA Dysarthria In Adults',
    url: 'https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/',
  },
  {
    id: 'asha-support',
    label: 'ASHA Communication Tips',
    url: 'https://www.asha.org/about/press-room/articles/tips-for-communicating-with-adults-who-have-a-speech-or-language-disorder/',
  },
  {
    id: 'ppc-bilingual',
    label: 'Patient Provider Communication - Chinese Simplified Tools',
    url: 'https://patientprovidercommunication.org/languages/chinese-simplified/',
  },
  {
    id: 'ppc-planning',
    label: 'Patient Provider Communication - Planning Tools',
    url: 'https://patientprovidercommunication.org/healthcare-visit-planning-tools/',
  },
  {
    id: 'ppc-tools',
    label: 'Patient Provider Communication - Communication Tools',
    url: 'https://patientprovidercommunication.org/tools-and-resources/communication-tools-and-materials/',
  },
  {
    id: 'tobii-emergency',
    label: 'Tobii Dynavox Emergency Response Resources',
    url: 'https://www.tobiidynavox.com/pages/emergency-response-resources',
  },
]

function phrase(
  id: string,
  text: string,
  note: string,
  sourceIds: string[],
): StarterKitPhrase {
  return { id, text, note, sourceIds }
}

function group(
  id: StarterKitPhraseGroup['id'],
  title: string,
  description: string,
  phrases: StarterKitPhrase[],
): StarterKitPhraseGroup {
  return { id, title, description, phrases }
}

export const STARTER_KIT_QUICK_ACTIONS: StarterKitPhrase[] = [
  phrase('yes', '是的。', '先给一个低负担确认方式。', ['ppc-bilingual']),
  phrase('no', '不是。', '适合快速确认。', ['ppc-bilingual']),
  phrase('repeat', '请再说一遍。', '对方说太快或没听清时先稳住节奏。', ['asha-support', 'ppc-planning']),
  phrase('write', '如果你没听清，请写给我看。', '必要时切到文字支持。', ['asha-aac', 'ppc-tools']),
  phrase('one-by-one', '请一个问题一个问题问我。', '降低信息密度。', ['ppc-planning', 'asha-dysarthria']),
  phrase('slow-down', '请慢一点，我需要一点时间。', '先保住理解和回应时间。', ['asha-support', 'ppc-planning']),
]

export const STARTER_KIT_SCENES: StarterKitScene[] = [
  {
    id: 'interview',
    title: '求职 / 面试',
    icon: '💼',
    description: '先守住表达权，再把结论、能力和例子说清楚。',
    rationale: '高压陌生场景里，先建立沟通预期、再给结论，能减少第一印象直接误伤。',
    focusPoints: ['先说沟通节奏', '先给结论', '再补一条最能证明能力的例子'],
    sections: [
      group('opening', '先开口', '先让面试官知道怎么和你沟通。', [
        phrase('interview-opening-1', '我说话会慢一点，但我知道自己要表达什么，请先听我说完。', '先说明沟通节奏。', ['asha-dysarthria', 'asha-support']),
        phrase('interview-opening-2', '如果你没听清，可以直接提醒我，我会换一种方式说。', '把误听变成可补救反馈。', ['asha-support', 'ppc-planning']),
        phrase('interview-opening-3', '请直接和我沟通，我可以自己回答。', '减少陪同者替答。', ['asha-aac', 'asha-support']),
        phrase('interview-opening-4', '我先说结论，再补例子，这样会更清楚。', '先稳住表达结构。', ['asha-dysarthria']),
      ]),
      group('core', '关键内容句', '先说岗位匹配、结果和能力证据。', [
        phrase('interview-core-1', '我和这个岗位最匹配的是执行力和持续沟通能力。', '先说匹配点。', ['asha-dysarthria']),
        phrase('interview-core-2', '这段经历里，我负责推进事情落地。', '适合项目经验。', ['asha-dysarthria']),
        phrase('interview-core-3', '我先讲结果，再补我怎么做到的。', '先把重点交出去。', ['asha-support']),
        phrase('interview-core-4', '这件事最能说明我能稳定完成任务。', '突出可靠性。', ['asha-dysarthria']),
      ]),
      group('repair', '没听清时', '不要急着解释很多，先把这轮问题修回来。', [
        phrase('interview-repair-1', '刚才那句我再说一次，我的重点是岗位匹配。', '重说时先点主题。', ['asha-support']),
        phrase('interview-repair-2', '如果需要，我可以换更短的说法。', '切短句。', ['asha-dysarthria', 'ppc-planning']),
        phrase('interview-repair-3', '我先说关键词，再补完整句。', '先保关键词。', ['asha-dysarthria']),
        phrase('interview-repair-4', '这部分我想说的是结果，不是过程。', '拉回主线。', ['asha-support']),
      ]),
      group('partner', '希望对方怎么配合', '直接告诉对方什么样的互动最有效。', [
        phrase('interview-partner-1', '请等我把一句话说完，再继续追问。', '避免半句被打断。', ['asha-support']),
        phrase('interview-partner-2', '如果你想确认，请直接重复你听到的关键词。', '降低误会。', ['ppc-planning']),
        phrase('interview-partner-3', '请一次问一个重点，我回答会更清楚。', '控制问题密度。', ['ppc-planning', 'asha-dysarthria']),
        phrase('interview-partner-4', '如果环境太吵，我们可以换到更安静一点的位置。', '环境噪声会显著影响 intelligibility。', ['asha-support']),
      ]),
      group('switch', '说不顺时这样切', '必要时先换成更保真的表达方式。', [
        phrase('interview-switch-1', '我可以把关键词写下来，你先看结论。', '切到文字。', ['asha-aac', 'ppc-tools']),
        phrase('interview-switch-2', '我先把最重要的三点列出来。', '转为列表表达。', ['asha-support']),
        phrase('interview-switch-3', '这题我先回答最关键的一句。', '避免整段崩掉。', ['asha-dysarthria']),
      ]),
    ],
  },
  {
    id: 'workplace',
    title: '工作协作',
    icon: '🧩',
    description: '先把判断和风险说出来，再说建议动作。',
    rationale: '团队场景里最重要的是让别人先听到你的判断，而不是先被表达形式带偏。',
    focusPoints: ['先说判断', '再说风险', '最后说建议动作'],
    sections: [
      group('opening', '先开口', '先争取完整表达窗口。', [
        phrase('workplace-opening-1', '请先让我把关键点说完，再一起决定。', '先保发言权。', ['asha-support', 'ppc-planning']),
        phrase('workplace-opening-2', '如果你没听清，请直接问我，不用替我判断。', '减少被代替决策。', ['asha-aac', 'asha-support']),
        phrase('workplace-opening-3', '我先说核心判断，再补细节。', '先保核心。', ['asha-dysarthria']),
        phrase('workplace-opening-4', '这件事我有一个明确建议，请先听我一句。', '快速切入。', ['asha-support']),
      ]),
      group('core', '关键内容句', '适合会议、对齐、汇报。', [
        phrase('workplace-core-1', '我的判断是这个方案现在有风险。', '先把判断亮出来。', ['asha-dysarthria']),
        phrase('workplace-core-2', '如果现在不处理，后面会影响进度。', '风险句优先。', ['asha-support']),
        phrase('workplace-core-3', '我建议先做最小调整，再决定下一步。', '先给动作。', ['asha-support']),
        phrase('workplace-core-4', '我先说结论：这个版本不适合直接上线。', '适合决策场景。', ['asha-dysarthria']),
      ]),
      group('repair', '没听清时', '把讨论拉回你真正要表达的重点。', [
        phrase('workplace-repair-1', '我重说一次，重点是风险，不是细节。', '避免讨论跑偏。', ['asha-support']),
        phrase('workplace-repair-2', '我先说关键词：进度、风险、回滚。', '先用关键词托底。', ['asha-dysarthria']),
        phrase('workplace-repair-3', '如果这句没听清，我可以换成更短的说法。', '切短句。', ['asha-dysarthria']),
        phrase('workplace-repair-4', '请先确认你听到的结论，我再补原因。', '先校正理解。', ['ppc-planning']),
      ]),
      group('partner', '希望对方怎么配合', '直接要求更适合你的会议节奏。', [
        phrase('workplace-partner-1', '请先让我说完一句，再决定是否插话。', '控制打断。', ['asha-support']),
        phrase('workplace-partner-2', '请一次只确认一个问题。', '降低负担。', ['ppc-planning']),
        phrase('workplace-partner-3', '如果有专业词没听清，请直接重复那个词。', '保专业词。', ['asha-dysarthria']),
        phrase('workplace-partner-4', '这部分如果需要，我可以打字补关键词。', '多模态补偿。', ['asha-aac']),
      ]),
      group('switch', '说不顺时这样切', '优先保决定、动作和关键词。', [
        phrase('workplace-switch-1', '我先只说建议动作。', '先保可执行结论。', ['asha-support']),
        phrase('workplace-switch-2', '我先把风险词列出来。', '适合快节奏会议。', ['asha-dysarthria']),
        phrase('workplace-switch-3', '我把核心点写在聊天框里。', '必要时切文字。', ['asha-aac']),
      ]),
    ],
  },
  {
    id: 'stranger',
    title: '陌生人开口',
    icon: '🗣️',
    description: '先说明自己说话状态，再把诉求说出来。',
    rationale: '先建立预期，往往比直接硬说内容更能减少尴尬和误解。',
    focusPoints: ['先说明自己说话状态', '先说你想做什么', '没听清就立刻补救'],
    sections: [
      group('opening', '先开口', '让对方立刻知道你需要一点时间。', [
        phrase('stranger-opening-1', '我现在说话不太清楚，请给我一点时间。', '先说明状态。', ['asha-aac', 'asha-dysarthria']),
        phrase('stranger-opening-2', '请直接和我说，我可以慢一点回答。', '减少转向陪同者。', ['asha-support']),
        phrase('stranger-opening-3', '如果你没听清，请直接告诉我。', '把误听说开。', ['asha-support']),
        phrase('stranger-opening-4', '我能说清楚，只是需要慢一点。', '先稳住场面。', ['asha-dysarthria']),
      ]),
      group('core', '关键内容句', '适合问路、求助、买东西、社交开口。', [
        phrase('stranger-core-1', '我想先说明一下我的情况。', '开话题。', ['asha-support']),
        phrase('stranger-core-2', '我需要你帮我一个忙。', '快速进入诉求。', ['asha-aac']),
        phrase('stranger-core-3', '我想表达的是这个，不是刚才那个意思。', '修正误解。', ['asha-dysarthria']),
        phrase('stranger-core-4', '请先听我说完这句话。', '适合被打断时。', ['asha-support']),
      ]),
      group('repair', '没听清时', '先修通道，不要急着整段重来。', [
        phrase('stranger-repair-1', '我再说一遍关键词。', '用关键词重建理解。', ['asha-dysarthria']),
        phrase('stranger-repair-2', '如果不清楚，我可以换更短的说法。', '切短句。', ['asha-support']),
        phrase('stranger-repair-3', '我想说的是这个主题。', '先拉回主题。', ['asha-dysarthria']),
        phrase('stranger-repair-4', '请告诉我你听到了哪几个词。', '获取反馈。', ['ppc-planning']),
      ]),
      group('partner', '希望对方怎么配合', '直接说出你需要什么样的帮助。', [
        phrase('stranger-partner-1', '请慢一点跟我说。', '降低速度。', ['asha-support']),
        phrase('stranger-partner-2', '如果这里太吵，我们换个安静一点的地方。', '环境管理。', ['asha-support']),
        phrase('stranger-partner-3', '请一次问我一个问题。', '降低信息密度。', ['ppc-planning']),
        phrase('stranger-partner-4', '如果还是没听清，请让我写下来。', '切文字。', ['asha-aac', 'ppc-tools']),
      ]),
      group('switch', '说不顺时这样切', '优先保住诉求本身。', [
        phrase('stranger-switch-1', '我先说最重要的那个词。', '先保主题词。', ['asha-dysarthria']),
        phrase('stranger-switch-2', '我用手机打字给你看。', '多模态兜底。', ['asha-aac']),
        phrase('stranger-switch-3', '我先回答是或不是。', '必要时改为低负担回答。', ['ppc-bilingual']),
      ]),
    ],
  },
  {
    id: 'medical',
    title: '就医沟通',
    icon: '🏥',
    description: '先说哪里不舒服、现在需要什么、再说要不要解释或决定。',
    rationale: '医疗沟通优先级通常是症状、部位、需求、解释、决定。',
    focusPoints: ['先说症状和位置', '再说需要谁或什么帮助', '最后再做决定或确认'],
    sections: [
      group('opening', '先开口', '先建立节奏，再进入症状。', [
        phrase('medical-opening-1', '请慢一点说，我需要一点时间回答。', '降低医疗信息密度。', ['ppc-planning', 'asha-support']),
        phrase('medical-opening-2', '请直接和我说，我可以自己回答。', '保留患者表达权。', ['ppc-planning', 'asha-support']),
        phrase('medical-opening-3', '请一个问题一个问题问我。', '适合问诊。', ['ppc-planning']),
        phrase('medical-opening-4', '如果你没听清，请直接让我重复。', '减少默认失败。', ['asha-support']),
      ]),
      group('core', '关键内容句', '症状、需求、解释、决策优先。', [
        phrase('medical-core-1', '我现在最不舒服的是这里。', '先说位置。', ['ppc-bilingual', 'tobii-emergency']),
        phrase('medical-core-2', '我现在需要医生或护士。', '先说对象。', ['ppc-bilingual', 'tobii-emergency']),
        phrase('medical-core-3', '我这里疼，请先处理这里。', '疼痛优先。', ['ppc-bilingual']),
        phrase('medical-core-4', '请先解释清楚，我再决定。', '保留知情与决定权。', ['ppc-planning', 'ppc-bilingual']),
        phrase('medical-core-5', '我想问的是接下来要做什么检查。', '明确问题。', ['ppc-planning']),
      ]),
      group('repair', '没听清时', '先把症状和决定修正清楚。', [
        phrase('medical-repair-1', '我重说一次，重点是疼痛和位置。', '聚焦症状。', ['ppc-bilingual']),
        phrase('medical-repair-2', '我想说的是这里，不是别的地方。', '纠正部位误听。', ['ppc-bilingual']),
        phrase('medical-repair-3', '请先确认你听到的症状。', '确认理解。', ['ppc-planning']),
        phrase('medical-repair-4', '如果不清楚，我可以指给你看。', '切换指认。', ['ppc-tools']),
      ]),
      group('partner', '希望对方怎么配合', '清楚告诉医护人员怎样和你沟通更有效。', [
        phrase('medical-partner-1', '请一句一句问我。', '降低信息密度。', ['ppc-planning']),
        phrase('medical-partner-2', '请先确认关键词，再继续解释。', '先确认再展开。', ['ppc-planning']),
        phrase('medical-partner-3', '如果有选择，请一项一项告诉我。', '适合治疗决定。', ['ppc-tools']),
        phrase('medical-partner-4', '请把关键信息写下来给我看。', '提升理解与回看能力。', ['ppc-tools']),
      ]),
      group('switch', '说不顺时这样切', '优先保症状、位置、药物、决定。', [
        phrase('medical-switch-1', '我先只说症状。', '先保最关键的医学信息。', ['ppc-bilingual']),
        phrase('medical-switch-2', '我先指出位置，再补说明。', '位置优先。', ['ppc-tools']),
        phrase('medical-switch-3', '请给我是或否的选项。', '适合体力差或急症。', ['ppc-bilingual']),
      ]),
    ],
  },
  {
    id: 'caregiver',
    title: '家人 / 照护',
    icon: '🏠',
    description: '先说当前需求，再说节奏，不要让家人直接替你回答。',
    rationale: '家庭场景里最常见的问题不是没有帮助，而是帮助来得太快，直接覆盖了用户自己的表达。',
    focusPoints: ['先说当前需求', '再说想怎么被帮助', '明确不要替我回答'],
    sections: [
      group('opening', '先开口', '先把需求和节奏说出来。', [
        phrase('caregiver-opening-1', '请先听我说完，再帮我。', '先保表达。', ['asha-support']),
        phrase('caregiver-opening-2', '我现在需要一点时间。', '先争取节奏。', ['asha-support']),
        phrase('caregiver-opening-3', '先别替我回答，让我自己说。', '避免抢答。', ['asha-aac', 'asha-support']),
        phrase('caregiver-opening-4', '我先说需求，再说原因。', '先保需求。', ['asha-dysarthria']),
      ]),
      group('core', '关键内容句', '优先说需求、身体状态和安排。', [
        phrase('caregiver-core-1', '我现在想先休息一下。', '表达状态。', ['asha-aac', 'ppc-bilingual']),
        phrase('caregiver-core-2', '我现在需要喝水。', '基础需求。', ['ppc-bilingual']),
        phrase('caregiver-core-3', '我想先自己试一下。', '表达自主性。', ['asha-support']),
        phrase('caregiver-core-4', '请帮我联系家人。', '需要额外支持时。', ['ppc-bilingual', 'tobii-emergency']),
      ]),
      group('repair', '没听清时', '避免家庭沟通越急越乱。', [
        phrase('caregiver-repair-1', '我再说一遍，我现在最需要的是这个。', '拉回需求。', ['asha-support']),
        phrase('caregiver-repair-2', '你先听关键词。', '先保关键词。', ['asha-dysarthria']),
        phrase('caregiver-repair-3', '我想说的是现在，不是等会儿。', '纠正时间误会。', ['asha-support']),
        phrase('caregiver-repair-4', '如果还不清楚，我可以指给你看。', '切到指认。', ['asha-aac']),
      ]),
      group('partner', '希望对方怎么配合', '告诉家人怎么问、怎么等、怎么帮。', [
        phrase('caregiver-partner-1', '请一个问题一个问题问我。', '降低密度。', ['ppc-planning']),
        phrase('caregiver-partner-2', '请等我说完再猜。', '不要抢先补全。', ['asha-support']),
        phrase('caregiver-partner-3', '如果没听清，请重复你听到的那个词。', '先确认理解。', ['ppc-planning']),
        phrase('caregiver-partner-4', '请慢一点，我会更容易回答。', '管理节奏。', ['asha-support']),
      ]),
      group('switch', '说不顺时这样切', '优先保需求句。', [
        phrase('caregiver-switch-1', '我先说要不要。', '切 yes/no。', ['ppc-bilingual']),
        phrase('caregiver-switch-2', '我先说最需要的那个词。', '保需求。', ['asha-dysarthria']),
        phrase('caregiver-switch-3', '我写下来给你看。', '切文字。', ['asha-aac']),
      ]),
    ],
  },
  {
    id: 'emergency',
    title: '紧急求助',
    icon: '🚨',
    description: '先求助，再说身体状态、位置和要联系谁。',
    rationale: '紧急场景不追求完整长句，只追求求助、症状、位置、联系人四件事尽快被听懂。',
    focusPoints: ['先求助', '再说症状或危险', '再说去哪里或联系谁'],
    sections: [
      group('opening', '先开口', '第一句必须先把紧急程度打出来。', [
        phrase('emergency-opening-1', '我现在需要马上帮助。', '先打出紧急级别。', ['tobii-emergency']),
        phrase('emergency-opening-2', '请不要离开我。', '先稳住周围人。', ['tobii-emergency']),
        phrase('emergency-opening-3', '请先听我一句，我现在很不舒服。', '争取一秒注意力。', ['tobii-emergency', 'asha-support']),
        phrase('emergency-opening-4', '请帮我，现在。', '极短求助句。', ['tobii-emergency']),
      ]),
      group('core', '关键内容句', '只保最关键的需求、症状、位置、联系人。', [
        phrase('emergency-core-1', '我呼吸困难。', '高优先症状。', ['tobii-emergency']),
        phrase('emergency-core-2', '我头晕，站不稳。', '状态句。', ['tobii-emergency']),
        phrase('emergency-core-3', '请带我去急诊。', '决策句。', ['tobii-emergency']),
        phrase('emergency-core-4', '请马上联系我的家人。', '联系人句。', ['tobii-emergency', 'ppc-bilingual']),
        phrase('emergency-core-5', '我这里疼，请先看这里。', '位置优先。', ['ppc-bilingual', 'tobii-emergency']),
      ]),
      group('repair', '没听清时', '不要解释太多，继续保住求助和症状。', [
        phrase('emergency-repair-1', '我重说一次，重点是呼吸和疼痛。', '先保症状。', ['tobii-emergency']),
        phrase('emergency-repair-2', '请先确认你听到的是不是“急诊”。', '确认决定词。', ['tobii-emergency']),
        phrase('emergency-repair-3', '如果没听清，请看我指的位置。', '切到指认。', ['ppc-tools']),
        phrase('emergency-repair-4', '我现在只能说短句。', '管理预期。', ['asha-support']),
      ]),
      group('partner', '希望对方怎么配合', '直接指挥现场如何帮助你。', [
        phrase('emergency-partner-1', '请一句一句问我。', '降低负担。', ['ppc-planning']),
        phrase('emergency-partner-2', '请带我到安静安全的地方。', '环境安全。', ['tobii-emergency']),
        phrase('emergency-partner-3', '请帮我报警或叫急救。', '外部援助。', ['tobii-emergency']),
        phrase('emergency-partner-4', '请给我写字或手机。', '切换支持方式。', ['ppc-tools', 'asha-aac']),
      ]),
      group('switch', '说不顺时这样切', '只保最短、最硬的求助信息。', [
        phrase('emergency-switch-1', '我先说症状。', '保医学关键信息。', ['tobii-emergency']),
        phrase('emergency-switch-2', '我先说去哪里。', '保行动方向。', ['tobii-emergency']),
        phrase('emergency-switch-3', '请给我是或否。', '极限低负担互动。', ['ppc-bilingual']),
      ]),
    ],
  },
]
