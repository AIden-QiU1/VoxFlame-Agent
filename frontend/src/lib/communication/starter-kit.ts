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

export interface StarterKitScene {
  id: 'stranger' | 'medical' | 'caregiver' | 'emergency'
  title: string
  icon: string
  description: string
  rationale: string
  phrases: StarterKitPhrase[]
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
    id: 'tobii-emergency',
    label: 'Tobii Dynavox Emergency Response Resources',
    url: 'https://us.tobiidynavox.com/blogs/news/emergency-response-resources-for-people-with-communication-disabilities',
  },
]

export const STARTER_KIT_QUICK_ACTIONS: StarterKitPhrase[] = [
  {
    id: 'yes',
    text: '是的。',
    note: '是 / 否 是 AAC 和医疗沟通板的基础单位。',
    sourceIds: ['ppc-bilingual'],
  },
  {
    id: 'no',
    text: '不是。',
    note: '先给用户一个低负担确认方式。',
    sourceIds: ['ppc-bilingual'],
  },
  {
    id: 'repeat',
    text: '请再说一遍。',
    note: '适合在没听清或需要更多时间时兜底。',
    sourceIds: ['asha-aac', 'ppc-planning'],
  },
  {
    id: 'write',
    text: '如果你没听清，请写给我看。',
    note: '符合 AAC 的多模态补偿思路。',
    sourceIds: ['asha-aac', 'asha-dysarthria'],
  },
]

export const STARTER_KIT_SCENES: StarterKitScene[] = [
  {
    id: 'stranger',
    title: '陌生人开口',
    icon: '🗣️',
    description: '先解释自己的说话状态，再继续沟通。',
    rationale: 'ASHA 对 AAC 与 dysarthria 的建议都强调：先建立沟通预期，能显著降低误解和尴尬。',
    phrases: [
      {
        id: 'stranger-time',
        text: '我现在说话不太清楚，请给我一点时间。',
        note: '先说明状态，再争取时间。',
        sourceIds: ['asha-aac', 'asha-dysarthria'],
      },
      {
        id: 'stranger-direct',
        text: '请直接和我说，我可以慢一点回答。',
        note: '强化“直接对我说”，避免被同伴替答。',
        sourceIds: ['ppc-planning', 'asha-aac'],
      },
      {
        id: 'stranger-clarify',
        text: '如果你没听清，请告诉我，我可以换一种方式表达。',
        note: '把“没听懂”从尴尬变成明确反馈。',
        sourceIds: ['asha-dysarthria', 'asha-aac'],
      },
    ],
  },
  {
    id: 'medical',
    title: '就医沟通',
    icon: '🏥',
    description: '优先覆盖疼痛、速度、解释和决策四类核心表达。',
    rationale: '医疗沟通板通常优先收纳疼痛、需求、是/否、治疗决定与检查解释。',
    phrases: [
      {
        id: 'medical-help',
        text: '我现在需要医生或护士。',
        note: '先把帮助对象说清楚。',
        sourceIds: ['ppc-bilingual', 'tobii-emergency'],
      },
      {
        id: 'medical-pain',
        text: '我这里疼，请先帮我处理。',
        note: '疼痛表达是医疗沟通板的高频项。',
        sourceIds: ['ppc-bilingual', 'tobii-emergency'],
      },
      {
        id: 'medical-slow',
        text: '请慢一点说，我需要一点时间回答。',
        note: '降低信息密度，减少沟通失败。',
        sourceIds: ['ppc-planning', 'asha-dysarthria'],
      },
      {
        id: 'medical-decide',
        text: '请先给我解释清楚，我再决定。',
        note: '保留患者本人决策权。',
        sourceIds: ['ppc-bilingual', 'ppc-planning'],
      },
    ],
  },
  {
    id: 'caregiver',
    title: '家人 / 照护',
    icon: '🏠',
    description: '把“需求”和“节奏”说出来，避免家人抢答。',
    rationale: 'AAC 的基础功能是表达 wants / needs / feelings；家庭场景需要先把需求和节奏说清楚。',
    phrases: [
      {
        id: 'caregiver-listen',
        text: '请先听我说完，再一起决定。',
        note: '降低家人过早替代判断。',
        sourceIds: ['asha-aac', 'ppc-planning'],
      },
      {
        id: 'caregiver-rest',
        text: '我现在想先休息一下。',
        note: '表达身体和情绪状态。',
        sourceIds: ['asha-aac', 'ppc-bilingual'],
      },
      {
        id: 'caregiver-family',
        text: '请帮我联系家人。',
        note: '适合照护与陪同场景。',
        sourceIds: ['ppc-bilingual', 'tobii-emergency'],
      },
    ],
  },
  {
    id: 'emergency',
    title: '紧急求助',
    icon: '🚨',
    description: '先发出求助，再把安全、位置、协助对象说清楚。',
    rationale: '应急沟通资源优先强调求助、位置、安全和联系支持者。',
    phrases: [
      {
        id: 'emergency-now',
        text: '我现在不舒服，需要马上帮助。',
        note: '先建立紧急程度。',
        sourceIds: ['tobii-emergency', 'ppc-bilingual'],
      },
      {
        id: 'emergency-call',
        text: '请帮我联系急救或报警。',
        note: '明确要找的人和动作。',
        sourceIds: ['tobii-emergency'],
      },
      {
        id: 'emergency-safe',
        text: '请先带我去安静安全的地方。',
        note: '适合环境嘈杂、失序或过载场景。',
        sourceIds: ['tobii-emergency', 'asha-aac'],
      },
    ],
  },
]

