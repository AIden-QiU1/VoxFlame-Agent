/**
 * 燃言语料库 - 30句自然对话语料
 * 
 * 设计原则：
 * 1. 每句8-10字以上，自然口语化
 * 2. 贴近真实场景，覆盖日常需求
 * 3. 覆盖中文常见音素和声调
 * 4. 温暖、积极的情感基调
 */

export interface CorpusSentence {
  id: string
  text: string
  category: 'daily' | 'emotion' | 'health' | 'social' | 'environment' | 'story'
  difficulty: 'easy' | 'medium' | 'hard'
  charCount: number  // 字数
}

export const CORPUS_SENTENCES: CorpusSentence[] = [
  // ========== 日常需求 (8-12字) ==========
  {
    id: 'daily-01',
    text: '我现在想喝一杯温水',
    category: 'daily',
    difficulty: 'easy',
    charCount: 9,
  },
  {
    id: 'daily-02',
    text: '我有点饿了，想吃点东西',
    category: 'daily',
    difficulty: 'easy',
    charCount: 11,
  },
  {
    id: 'daily-03',
    text: '我想去卫生间，能帮我一下吗',
    category: 'daily',
    difficulty: 'medium',
    charCount: 13,
  },
  {
    id: 'daily-04',
    text: '帮我把眼镜拿过来好吗',
    category: 'daily',
    difficulty: 'easy',
    charCount: 10,
  },
  {
    id: 'daily-05',
    text: '今天天气真不错，想出去走走',
    category: 'daily',
    difficulty: 'medium',
    charCount: 12,
  },

  // ========== 情感表达 (8-15字) ==========
  {
    id: 'emotion-01',
    text: '谢谢你一直陪着我',
    category: 'emotion',
    difficulty: 'easy',
    charCount: 8,
  },
  {
    id: 'emotion-02',
    text: '今天心情特别好，很开心',
    category: 'emotion',
    difficulty: 'easy',
    charCount: 10,
  },
  {
    id: 'emotion-03',
    text: '我很想念家里的孩子们',
    category: 'emotion',
    difficulty: 'medium',
    charCount: 10,
  },
  {
    id: 'emotion-04',
    text: '你辛苦了，好好休息一下吧',
    category: 'emotion',
    difficulty: 'easy',
    charCount: 11,
  },
  {
    id: 'emotion-05',
    text: '有你在身边我就安心了',
    category: 'emotion',
    difficulty: 'medium',
    charCount: 10,
  },

  // ========== 健康相关 (8-15字) ==========
  {
    id: 'health-01',
    text: '我今天身体有点不太舒服',
    category: 'health',
    difficulty: 'medium',
    charCount: 11,
  },
  {
    id: 'health-02',
    text: '我的头有一点点疼',
    category: 'health',
    difficulty: 'easy',
    charCount: 8,
  },
  {
    id: 'health-03',
    text: '现在应该是吃药的时间了',
    category: 'health',
    difficulty: 'medium',
    charCount: 11,
  },
  {
    id: 'health-04',
    text: '今天感觉比昨天好多了',
    category: 'health',
    difficulty: 'medium',
    charCount: 10,
  },
  {
    id: 'health-05',
    text: '昨晚睡得不太好，有点累',
    category: 'health',
    difficulty: 'medium',
    charCount: 11,
  },

  // ========== 社交场景 (8-15字) ==========
  {
    id: 'social-01',
    text: '你好，很高兴认识你',
    category: 'social',
    difficulty: 'easy',
    charCount: 9,
  },
  {
    id: 'social-02',
    text: '再见了，路上小心一点',
    category: 'social',
    difficulty: 'easy',
    charCount: 10,
  },
  {
    id: 'social-03',
    text: '好久不见了，你最近怎么样',
    category: 'social',
    difficulty: 'medium',
    charCount: 12,
  },
  {
    id: 'social-04',
    text: '我想给孩子打一个电话',
    category: 'social',
    difficulty: 'medium',
    charCount: 10,
  },
  {
    id: 'social-05',
    text: '麻烦你了，能帮我个忙吗',
    category: 'social',
    difficulty: 'medium',
    charCount: 11,
  },

  // ========== 环境控制 (8-12字) ==========
  {
    id: 'env-01',
    text: '请帮我把灯打开好吗',
    category: 'environment',
    difficulty: 'easy',
    charCount: 9,
  },
  {
    id: 'env-02',
    text: '可以帮我把门关上吗',
    category: 'environment',
    difficulty: 'easy',
    charCount: 9,
  },
  {
    id: 'env-03',
    text: '空调温度有点低，能调高一点吗',
    category: 'environment',
    difficulty: 'hard',
    charCount: 14,
  },
  {
    id: 'env-04',
    text: '电视声音太大了，能小一点吗',
    category: 'environment',
    difficulty: 'medium',
    charCount: 13,
  },
  {
    id: 'env-05',
    text: '今天天气好，帮我把窗户打开吧',
    category: 'environment',
    difficulty: 'medium',
    charCount: 14,
  },

  // ========== 自我故事/长句 (12-20字) ==========
  {
    id: 'story-01',
    text: '我叫什么名字不重要，重要的是你能听懂我说的话',
    category: 'story',
    difficulty: 'hard',
    charCount: 20,
  },
  {
    id: 'story-02',
    text: '虽然我说话不太清楚，但是我心里什么都明白',
    category: 'story',
    difficulty: 'hard',
    charCount: 18,
  },
  {
    id: 'story-03',
    text: '每一个声音都值得被认真倾听',
    category: 'story',
    difficulty: 'medium',
    charCount: 13,
  },
  {
    id: 'story-04',
    text: '我想告诉你一个关于坚持和希望的故事',
    category: 'story',
    difficulty: 'hard',
    charCount: 16,
  },
  {
    id: 'story-05',
    text: '感谢你愿意花时间来理解我说的每一句话',
    category: 'story',
    difficulty: 'hard',
    charCount: 17,
  },
]

// 按难度分组
export const SENTENCES_BY_DIFFICULTY = {
  easy: CORPUS_SENTENCES.filter(s => s.difficulty === 'easy'),
  medium: CORPUS_SENTENCES.filter(s => s.difficulty === 'medium'),
  hard: CORPUS_SENTENCES.filter(s => s.difficulty === 'hard'),
}

// 按类别分组
export const SENTENCES_BY_CATEGORY = {
  daily: CORPUS_SENTENCES.filter(s => s.category === 'daily'),
  emotion: CORPUS_SENTENCES.filter(s => s.category === 'emotion'),
  health: CORPUS_SENTENCES.filter(s => s.category === 'health'),
  social: CORPUS_SENTENCES.filter(s => s.category === 'social'),
  environment: CORPUS_SENTENCES.filter(s => s.category === 'environment'),
  story: CORPUS_SENTENCES.filter(s => s.category === 'story'),
}

// 类别中文名称
export const CATEGORY_NAMES: Record<CorpusSentence['category'], string> = {
  daily: '日常需求',
  emotion: '情感表达',
  health: '健康相关',
  social: '社交场景',
  environment: '环境控制',
  story: '自我故事',
}

// 难度中文名称
export const DIFFICULTY_NAMES: Record<CorpusSentence['difficulty'], string> = {
  easy: '简单',
  medium: '中等',
  hard: '挑战',
}

// 获取随机句子
export function getRandomSentence(
  difficulty?: CorpusSentence['difficulty'],
  excludeIds?: string[]
): CorpusSentence | null {
  let pool = difficulty 
    ? SENTENCES_BY_DIFFICULTY[difficulty] 
    : CORPUS_SENTENCES
  
  if (excludeIds && excludeIds.length > 0) {
    pool = pool.filter(s => !excludeIds.includes(s.id))
  }
  
  if (pool.length === 0) return null
  
  return pool[Math.floor(Math.random() * pool.length)]
}

// 获取下一个句子（按顺序）
export function getNextSentence(currentIndex: number): CorpusSentence | null {
  if (currentIndex >= CORPUS_SENTENCES.length - 1) return null
  return CORPUS_SENTENCES[currentIndex + 1]
}

// 统计信息
export const CORPUS_STATS = {
  totalSentences: CORPUS_SENTENCES.length,
  avgCharCount: Math.round(CORPUS_SENTENCES.reduce((sum, s) => sum + s.charCount, 0) / CORPUS_SENTENCES.length),
  minCharCount: Math.min(...CORPUS_SENTENCES.map(s => s.charCount)),
  maxCharCount: Math.max(...CORPUS_SENTENCES.map(s => s.charCount)),
}
