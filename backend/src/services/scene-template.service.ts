export type SceneTemplateCategory =
  | 'medical'
  | 'profession'
  | 'family'
  | 'daily'
  | 'emergency';

export interface SceneTemplateTerm {
  phrase: string;
  category: SceneTemplateCategory;
  note: string;
}

export interface SceneTemplateDefinition {
  id: string;
  title: string;
  summary: string;
  scenario: string;
  severity_hint: string;
  condition_hint: string;
  communication_goal: string;
  source_basis: string;
  focus_priority: string[];
  risky_terms: string[];
  support_strategies: string[];
  starter_phrases: string[];
  hotwords: SceneTemplateTerm[];
  updated_at: string;
}

export interface SceneTemplateHotwordProfileRecord {
  id: string;
  phrase: string;
  category: SceneTemplateCategory;
  scenario: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

const SCENE_TEMPLATE_UPDATED_AT = '2026-04-17T00:00:00.000Z';

const SCENE_TEMPLATE_LIBRARY: SceneTemplateDefinition[] = [
  {
    id: 'medical-visit-moderate',
    title: '就医沟通 · 中度构音障碍',
    summary: '适合门诊、复诊、康复问诊。优先保护症状位置、科室、治疗名和决定句。',
    scenario: 'medical',
    severity_hint: '中度',
    condition_hint: '适合 unfamiliar listeners 较多、需要更多上下文支持的就医场景。',
    communication_goal: '先让系统听准症状、位置、治疗项目，再进入解释和决定。',
    source_basis: '参考 ASHA dysarthria adults、Patient Provider Communication 医疗计划工具与沟通板整理。',
    focus_priority: ['先说哪里不舒服', '再说需要谁', '最后再做决定'],
    risky_terms: ['吞咽评估', '言语治疗', '康复科', '复诊安排'],
    support_strategies: ['请一句一句问我', '请慢一点说', '请先确认关键词', '必要时写下来给我看'],
    starter_phrases: ['我现在最不舒服的是这里。', '请先解释清楚，我再决定。', '请一个问题一个问题问我。'],
    hotwords: [
      { phrase: '康复科', category: 'medical', note: '科室名要优先保真。' },
      { phrase: '言语治疗', category: 'medical', note: '治疗名容易被听成泛化表达。' },
      { phrase: '吞咽评估', category: 'medical', note: '专业术语识别稳定性很重要。' },
      { phrase: '复诊安排', category: 'medical', note: '流程词在就医场景高频出现。' },
      { phrase: '检查结果', category: 'medical', note: '常见问诊和决定句核心词。' },
      { phrase: '疼痛位置', category: 'medical', note: '身体位置与症状要先保护。' },
    ],
    updated_at: SCENE_TEMPLATE_UPDATED_AT,
  },
  {
    id: 'emergency-short-severe',
    title: '紧急求助 · 重度构音障碍',
    summary: '适合只能稳定说短句或关键词的高压场景，优先保求助、症状、位置、联系人。',
    scenario: 'urgent',
    severity_hint: '重度',
    condition_hint: '适合 speech intelligibility 明显下降、只能先保极短信息的场景。',
    communication_goal: '不追求长句完整，先让系统和现场听准求助词与症状词。',
    source_basis: '参考 Tobii Dynavox emergency resources 与 Patient Provider Communication 紧急沟通资源整理。',
    focus_priority: ['先求助', '再说症状', '最后说去哪里或联系谁'],
    risky_terms: ['呼吸困难', '头晕', '胸口疼', '去急诊'],
    support_strategies: ['请不要离开我', '请带我到安静安全的地方', '请一句一句问我', '请给我是或否'],
    starter_phrases: ['我现在需要马上帮助。', '我呼吸困难。', '请马上联系我的家人。'],
    hotwords: [
      { phrase: '帮我', category: 'emergency', note: '求助触发词。' },
      { phrase: '呼吸困难', category: 'emergency', note: '高优先症状词。' },
      { phrase: '头晕', category: 'emergency', note: '需要快速响应的状态词。' },
      { phrase: '去急诊', category: 'emergency', note: '行动决策词。' },
      { phrase: '联系家人', category: 'emergency', note: '支持者召回词。' },
      { phrase: '胸口疼', category: 'emergency', note: '疼痛与部位表达。' },
    ],
    updated_at: SCENE_TEMPLATE_UPDATED_AT,
  },
  {
    id: 'family-care-moderate',
    title: '家庭照护 · 中度构音障碍',
    summary: '适合日常照护、吃饭、休息、身体需求表达，重点保护需求词和节奏句。',
    scenario: 'daily_care',
    severity_hint: '中度',
    condition_hint: '适合家庭成员熟悉但容易抢答、节奏过快的长期照护场景。',
    communication_goal: '先让家人听准需求，再让家人按更适合的方式提问和协助。',
    source_basis: '参考 ASHA AAC、ASHA communication tips 和支持性沟通建议整理。',
    focus_priority: ['先说需求', '再说怎么帮', '明确不要替我回答'],
    risky_terms: ['喝水', '上厕所', '先休息', '别替我回答'],
    support_strategies: ['请一个问题一个问题问我', '请等我说完再猜', '如果没听清请重复关键词'],
    starter_phrases: ['我现在需要喝水。', '先别替我回答，让我自己说。', '请先听我说完，再帮我。'],
    hotwords: [
      { phrase: '喝水', category: 'family', note: '基础需求词。' },
      { phrase: '上厕所', category: 'family', note: '照护高频词。' },
      { phrase: '先休息', category: 'daily', note: '身体状态与安排词。' },
      { phrase: '慢一点', category: 'daily', note: '常见节奏补救句。' },
      { phrase: '自己说', category: 'family', note: '避免家人抢答。' },
      { phrase: '喉咙不舒服', category: 'family', note: '家庭场景常见身体状态词。' },
    ],
    updated_at: SCENE_TEMPLATE_UPDATED_AT,
  },
  {
    id: 'work-meeting-mild',
    title: '工作协作 · 轻度构音障碍',
    summary: '适合会议、项目对齐、风险提醒。优先保护项目词、动作词和结论句。',
    scenario: 'work',
    severity_hint: '轻度',
    condition_hint: '适合还能说长句，但专业词、英文词、会议动作词容易被听偏的场景。',
    communication_goal: '先让系统保住判断、风险和下一步动作，不让讨论跑偏。',
    source_basis: '参考 ASHA dysarthria adults 对说话速度、清晰度与环境影响的描述整理。',
    focus_priority: ['先说判断', '再说风险', '最后说建议动作'],
    risky_terms: ['版本回滚', '项目进度', '客户反馈', '上线节奏'],
    support_strategies: ['请先让我把关键点说完', '如果没听清请重复那个专业词', '我先说结论再补原因'],
    starter_phrases: ['我的判断是这个方案现在有风险。', '我先说结论，再补细节。', '请先让我把关键点说完。'],
    hotwords: [
      { phrase: '项目进度', category: 'profession', note: '会议高频主题词。' },
      { phrase: '客户反馈', category: 'profession', note: '容易被听成泛化表达。' },
      { phrase: '版本回滚', category: 'profession', note: '动作词要优先保真。' },
      { phrase: '上线节奏', category: 'profession', note: '决策与排期词。' },
      { phrase: '风险判断', category: 'profession', note: '讨论核心词。' },
      { phrase: '下一步动作', category: 'profession', note: '会议结论词。' },
    ],
    updated_at: SCENE_TEMPLATE_UPDATED_AT,
  },
  {
    id: 'interview-self-intro-mild',
    title: '求职面试 · 轻度构音障碍',
    summary: '适合陌生高压场景。先说明沟通节奏，再保护岗位匹配、结果和能力证据。',
    scenario: 'interview',
    severity_hint: '轻度',
    condition_hint: '适合能较完整表达，但第一分钟最容易被误判的场景。',
    communication_goal: '先保开场控制权和岗位匹配信息，避免一开口就失去主线。',
    source_basis: '参考 ASHA 对 unfamiliar listeners、清晰度下降和沟通修复策略的建议整理。',
    focus_priority: ['先说沟通节奏', '先给结论', '再补一条例子'],
    risky_terms: ['岗位匹配', '执行力', '项目经历', '我可以自己回答'],
    support_strategies: ['请直接和我沟通', '如果没听清请直接提醒我', '我先说结论再补例子'],
    starter_phrases: ['我说话会慢一点，但我知道自己想表达什么。', '我先说结论，再补例子。', '请直接和我沟通，我可以自己回答。'],
    hotwords: [
      { phrase: '岗位匹配', category: 'profession', note: '面试结论词。' },
      { phrase: '项目经历', category: 'profession', note: '经验表达高频词。' },
      { phrase: '执行力', category: 'profession', note: '能力标签词。' },
      { phrase: '结果导向', category: 'profession', note: '可替换常见能力描述。' },
      { phrase: '自己回答', category: 'daily', note: '减少陪同者替答。' },
      { phrase: '慢一点', category: 'daily', note: '建立沟通节奏。' },
    ],
    updated_at: SCENE_TEMPLATE_UPDATED_AT,
  },
  {
    id: 'stranger-quick-help-moderate',
    title: '陌生人开口 · 中度构音障碍',
    summary: '适合问路、购物、短求助或第一次开口。先说明自己说话状态，再保住诉求词。',
    scenario: 'stranger',
    severity_hint: '中度',
    condition_hint: '适合陌生人、不熟悉你说话方式、环境可能偏吵的短沟通场景。',
    communication_goal: '先建立预期，再把最关键的诉求说出来，不让对方尴尬退出。',
    source_basis: '参考 ASHA communication tips、AAC 多模态补偿建议整理。',
    focus_priority: ['先说明自己说话状态', '先说你想做什么', '没听清就立刻补救'],
    risky_terms: ['给我一点时间', '直接和我说', '我可以写下来', '换安静一点的地方'],
    support_strategies: ['请慢一点跟我说', '请一次问我一个问题', '如果没听清请告诉我'],
    starter_phrases: ['我现在说话不太清楚，请给我一点时间。', '请直接和我说。', '如果你没听清，请直接告诉我。'],
    hotwords: [
      { phrase: '给我一点时间', category: 'daily', note: '建立沟通预期。' },
      { phrase: '直接和我说', category: 'daily', note: '避免对方转向陪同者。' },
      { phrase: '写下来', category: 'daily', note: '切文字补偿。' },
      { phrase: '安静一点', category: 'daily', note: '环境噪声管理。' },
      { phrase: '换一种方式', category: 'daily', note: '沟通修复句。' },
      { phrase: '先听我说完', category: 'daily', note: '争取完整表达窗口。' },
    ],
    updated_at: SCENE_TEMPLATE_UPDATED_AT,
  },
];

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

export function listSceneTemplates(): SceneTemplateDefinition[] {
  return SCENE_TEMPLATE_LIBRARY.map((template) => ({
    ...template,
    focus_priority: [...template.focus_priority],
    risky_terms: [...template.risky_terms],
    support_strategies: [...template.support_strategies],
    starter_phrases: [...template.starter_phrases],
    hotwords: template.hotwords.map((entry) => ({ ...entry })),
  }));
}

export function getSceneTemplateById(id: string): SceneTemplateDefinition | null {
  const match = SCENE_TEMPLATE_LIBRARY.find((template) => template.id === id);
  return match ? {
    ...match,
    focus_priority: [...match.focus_priority],
    risky_terms: [...match.risky_terms],
    support_strategies: [...match.support_strategies],
    starter_phrases: [...match.starter_phrases],
    hotwords: match.hotwords.map((entry) => ({ ...entry })),
  } : null;
}

export function normalizeSelectedSceneTemplateIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validIds = new Set(SCENE_TEMPLATE_LIBRARY.map((template) => template.id));
  return dedupeStrings(
    value.filter((item): item is string => typeof item === 'string'),
  ).filter((id) => validIds.has(id));
}

export function buildHotwordProfilesFromSceneTemplateIds(
  selectedTemplateIds: string[],
): SceneTemplateHotwordProfileRecord[] {
  const now = Date.now();

  return normalizeSelectedSceneTemplateIds(selectedTemplateIds).flatMap((templateId) => {
    const template = getSceneTemplateById(templateId);
    if (!template) {
      return [];
    }

    return template.hotwords.map((entry, index) => ({
      id: `${template.id}:${index}:${entry.phrase}`,
      phrase: entry.phrase,
      category: entry.category,
      scenario: template.scenario,
      note: `${template.title} · ${entry.note}`,
      createdAt: now,
      updatedAt: now,
    }));
  });
}
