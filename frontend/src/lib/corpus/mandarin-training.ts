export type MandarinTrainingCategory =
  | '陌生人开口'
  | '就医沟通'
  | '家人照护'
  | '紧急求助'

export type MandarinTrainingDifficulty = 'easy' | 'medium' | 'hard'

export interface MandarinTrainingSource {
  label: string
  url: string
  adapted: boolean
}

export interface MandarinTrainingExercise {
  id: string
  text: string
  pinyin: string
  category: MandarinTrainingCategory
  difficulty: MandarinTrainingDifficulty
  focusTags: string[]
  keywords: string[]
  coachingTip: string
  source: MandarinTrainingSource
}

export const MANDARIN_TRAINING_CATEGORIES: MandarinTrainingCategory[] = [
  '陌生人开口',
  '就医沟通',
  '家人照护',
  '紧急求助',
]

const EXERCISE_SOURCE_MAP: Record<MandarinTrainingCategory, MandarinTrainingSource> = {
  '陌生人开口': {
    label: '基于 AAC / 成人构音障碍沟通资料改写',
    url: 'https://www.asha.org/practice-portal/clinical-topics/dysarthria-in-adults/',
    adapted: true,
  },
  '就医沟通': {
    label: '基于中文医疗沟通板资料改写',
    url: 'https://patientprovidercommunication.org/languages/chinese-simplified/',
    adapted: true,
  },
  '家人照护': {
    label: '基于 AAC 沟通目的与直接沟通原则改写',
    url: 'https://www.asha.org/public/speech/disorders/aac/',
    adapted: true,
  },
  '紧急求助': {
    label: '基于应急沟通资源改写',
    url: 'https://us.tobiidynavox.com/blogs/news/emergency-response-resources-for-people-with-communication-disabilities',
    adapted: true,
  },
}

export const MANDARIN_TRAINING_EXERCISES: MandarinTrainingExercise[] = [
  {
    id: 'stranger_intro_time',
    text: '我现在说话不太清楚，请给我一点时间。',
    pinyin: 'wǒ xiàn zài shuō huà bù tài qīng chu, qǐng gěi wǒ yì diǎn shí jiān.',
    category: '陌生人开口',
    difficulty: 'medium',
    focusTags: ['平翘舌', '前后鼻音', '声调稳定'],
    keywords: ['说话', '清楚', '时间'],
    coachingTip: '先慢读“说话”“清楚”“时间”这几个容易连在一起的词。',
    source: EXERCISE_SOURCE_MAP['陌生人开口'],
  },
  {
    id: 'stranger_direct_reply',
    text: '请直接和我说，我可以慢一点回答。',
    pinyin: 'qǐng zhí jiē hé wǒ shuō, wǒ kě yǐ màn yì diǎn huí dá.',
    category: '陌生人开口',
    difficulty: 'medium',
    focusTags: ['翘舌音', '声调稳定', '送气对比'],
    keywords: ['直接', '慢一点', '回答'],
    coachingTip: '先把“直接”“回答”这两个词说稳，再连成整句。',
    source: EXERCISE_SOURCE_MAP['陌生人开口'],
  },
  {
    id: 'stranger_rephrase',
    text: '如果你没听清，请告诉我，我可以换一种方式表达。',
    pinyin: 'rú guǒ nǐ méi tīng qīng, qǐng gào sù wǒ, wǒ kě yǐ huàn yì zhǒng fāng shì biǎo dá.',
    category: '陌生人开口',
    difficulty: 'hard',
    focusTags: ['前后鼻音', '翘舌音', '送气对比'],
    keywords: ['听清', '告诉', '表达'],
    coachingTip: '这句较长，先分成两段练，再连起来读。',
    source: EXERCISE_SOURCE_MAP['陌生人开口'],
  },
  {
    id: 'stranger_write_it',
    text: '如果你没听清，请写给我看。',
    pinyin: 'rú guǒ nǐ méi tīng qīng, qǐng xiě gěi wǒ kàn.',
    category: '陌生人开口',
    difficulty: 'medium',
    focusTags: ['前后鼻音', '翘舌音'],
    keywords: ['听清', '写给我', '看'],
    coachingTip: '这句适合先练“听清”“写给我”两个片段，再连起来说。',
    source: EXERCISE_SOURCE_MAP['陌生人开口'],
  },
  {
    id: 'stranger_repeat_once',
    text: '请再说一遍。',
    pinyin: 'qǐng zài shuō yí biàn.',
    category: '陌生人开口',
    difficulty: 'easy',
    focusTags: ['翘舌音', '声调稳定'],
    keywords: ['再说', '一遍'],
    coachingTip: '这句短，但要把“说”“遍”收稳，避免尾音太弱。',
    source: EXERCISE_SOURCE_MAP['陌生人开口'],
  },
  {
    id: 'medical_slow_reply',
    text: '请慢一点说，我需要一点时间回答。',
    pinyin: 'qǐng màn yì diǎn shuō, wǒ xū yào yì diǎn shí jiān huí dá.',
    category: '就医沟通',
    difficulty: 'medium',
    focusTags: ['翘舌音', '前后鼻音', '声调稳定'],
    keywords: ['慢一点', '时间', '回答'],
    coachingTip: '重点关注“说”“时间”“回答”的节奏，句末先收稳再停。',
    source: EXERCISE_SOURCE_MAP['就医沟通'],
  },
  {
    id: 'medical_need_staff',
    text: '我现在需要医生或护士。',
    pinyin: 'wǒ xiàn zài xū yào yī shēng huò hù shì.',
    category: '就医沟通',
    difficulty: 'easy',
    focusTags: ['翘舌音', '声调稳定'],
    keywords: ['医生', '护士'],
    coachingTip: '这句适合先练“医生”“护士”两个关键词，再整句说。',
    source: EXERCISE_SOURCE_MAP['就医沟通'],
  },
  {
    id: 'medical_pain_help',
    text: '我这里疼，请先帮我处理。',
    pinyin: 'wǒ zhè lǐ téng, qǐng xiān bāng wǒ chǔ lǐ.',
    category: '就医沟通',
    difficulty: 'medium',
    focusTags: ['平翘舌', '前后鼻音', '边鼻音'],
    keywords: ['这里疼', '处理'],
    coachingTip: '先把“这里疼”说稳，再补“请先帮我处理”。',
    source: EXERCISE_SOURCE_MAP['就医沟通'],
  },
  {
    id: 'medical_explain_first',
    text: '请先给我解释清楚，我再决定。',
    pinyin: 'qǐng xiān gěi wǒ jiě shì qīng chu, wǒ zài jué dìng.',
    category: '就医沟通',
    difficulty: 'hard',
    focusTags: ['平翘舌', '前后鼻音', '声调稳定'],
    keywords: ['解释', '清楚', '决定'],
    coachingTip: '这句要先把“解释清楚”说稳，再补后半句“我再决定”。',
    source: EXERCISE_SOURCE_MAP['就医沟通'],
  },
  {
    id: 'medical_next_step',
    text: '请告诉我接下来要做什么。',
    pinyin: 'qǐng gào sù wǒ jiē xià lái yào zuò shén me.',
    category: '就医沟通',
    difficulty: 'medium',
    focusTags: ['送气对比', '声调稳定'],
    keywords: ['告诉我', '接下来', '做什么'],
    coachingTip: '先把“接下来”“做什么”分开练，再连回整句。',
    source: EXERCISE_SOURCE_MAP['就医沟通'],
  },
  {
    id: 'care_listen_first',
    text: '请先听我说完，再一起决定。',
    pinyin: 'qǐng xiān tīng wǒ shuō wán, zài yì qǐ jué dìng.',
    category: '家人照护',
    difficulty: 'medium',
    focusTags: ['前后鼻音', '平翘舌', '声调稳定'],
    keywords: ['听我说完', '一起决定'],
    coachingTip: '这句要避免越说越快，停顿放在“说完”后面更清楚。',
    source: EXERCISE_SOURCE_MAP['家人照护'],
  },
  {
    id: 'care_contact_family',
    text: '请帮我联系家人。',
    pinyin: 'qǐng bāng wǒ lián xì jiā rén.',
    category: '家人照护',
    difficulty: 'easy',
    focusTags: ['前后鼻音', '送气对比'],
    keywords: ['联系', '家人'],
    coachingTip: '重点看“联系”和“家人”，这两个词清楚了整句就更容易懂。',
    source: EXERCISE_SOURCE_MAP['家人照护'],
  },
  {
    id: 'care_rest_first',
    text: '我现在想先休息一下。',
    pinyin: 'wǒ xiàn zài xiǎng xiān xiū xi yí xià.',
    category: '家人照护',
    difficulty: 'easy',
    focusTags: ['声调稳定', '送气对比'],
    keywords: ['休息', '一下'],
    coachingTip: '这句适合把“休息一下”作为一个整体来练。',
    source: EXERCISE_SOURCE_MAP['家人照护'],
  },
  {
    id: 'care_answer_myself',
    text: '请不要替我回答，让我自己说。',
    pinyin: 'qǐng bú yào tì wǒ huí dá, ràng wǒ zì jǐ shuō.',
    category: '家人照护',
    difficulty: 'hard',
    focusTags: ['送气对比', '翘舌音', '声调稳定'],
    keywords: ['替我回答', '自己说'],
    coachingTip: '这句较长，先把“替我回答”“自己说”分成两段练。',
    source: EXERCISE_SOURCE_MAP['家人照护'],
  },
  {
    id: 'care_switch_expression',
    text: '我现在想换一种方式表达。',
    pinyin: 'wǒ xiàn zài xiǎng huàn yì zhǒng fāng shì biǎo dá.',
    category: '家人照护',
    difficulty: 'medium',
    focusTags: ['翘舌音', '声调稳定'],
    keywords: ['换一种', '表达'],
    coachingTip: '重点看“换一种方式表达”，不要一口气说得太快。',
    source: EXERCISE_SOURCE_MAP['家人照护'],
  },
  {
    id: 'emergency_help_now',
    text: '我现在不舒服，需要马上帮助。',
    pinyin: 'wǒ xiàn zài bù shū fu, xū yào mǎ shàng bāng zhù.',
    category: '紧急求助',
    difficulty: 'medium',
    focusTags: ['翘舌音', '声调稳定', '送气对比'],
    keywords: ['不舒服', '马上帮助'],
    coachingTip: '重点突出“不舒服”“马上帮助”，先把关键词说稳。',
    source: EXERCISE_SOURCE_MAP['紧急求助'],
  },
  {
    id: 'emergency_call_now',
    text: '请帮我联系急救或报警。',
    pinyin: 'qǐng bāng wǒ lián xì jí jiù huò bào jǐng.',
    category: '紧急求助',
    difficulty: 'medium',
    focusTags: ['前后鼻音', '送气对比', '声调稳定'],
    keywords: ['联系', '急救', '报警'],
    coachingTip: '先把“急救”“报警”两个动作词说清楚，再连回整句。',
    source: EXERCISE_SOURCE_MAP['紧急求助'],
  },
  {
    id: 'emergency_safe_place',
    text: '请先带我去安静安全的地方。',
    pinyin: 'qǐng xiān dài wǒ qù ān jìng ān quán de dì fang.',
    category: '紧急求助',
    difficulty: 'medium',
    focusTags: ['前后鼻音', '声调稳定'],
    keywords: ['安静', '安全', '地方'],
    coachingTip: '这句要把“安静安全”说成两个清楚的词，不要连成一团。',
    source: EXERCISE_SOURCE_MAP['紧急求助'],
  },
  {
    id: 'emergency_contact_caregiver',
    text: '请帮我联系家人或照护人。',
    pinyin: 'qǐng bāng wǒ lián xì jiā rén huò zhào hù rén.',
    category: '紧急求助',
    difficulty: 'medium',
    focusTags: ['翘舌音', '前后鼻音', '送气对比'],
    keywords: ['联系', '家人', '照护人'],
    coachingTip: '“照护人”这组词可以先单独练，再回到整句。',
    source: EXERCISE_SOURCE_MAP['紧急求助'],
  },
  {
    id: 'emergency_go_hospital',
    text: '我需要马上去医院。',
    pinyin: 'wǒ xū yào mǎ shàng qù yī yuàn.',
    category: '紧急求助',
    difficulty: 'easy',
    focusTags: ['声调稳定', '前后鼻音'],
    keywords: ['马上', '医院'],
    coachingTip: '这句短，重点把“马上”“医院”两个词说稳。',
    source: EXERCISE_SOURCE_MAP['紧急求助'],
  },
]

export function getExercisesByCategory(
  category: MandarinTrainingCategory | 'all',
): MandarinTrainingExercise[] {
  if (category === 'all') {
    return MANDARIN_TRAINING_EXERCISES
  }

  return MANDARIN_TRAINING_EXERCISES.filter((exercise) => exercise.category === category)
}

export function getExerciseById(id: string): MandarinTrainingExercise | undefined {
  return MANDARIN_TRAINING_EXERCISES.find((exercise) => exercise.id === id)
}
