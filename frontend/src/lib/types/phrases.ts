/**
 * 常用短语数据类型定义
 */

export interface QuickPhrase {
  id: string
  user_id: string
  text: string
  category: PhraseCategory
  tts_url?: string  // 预生成的 TTS 音频 URL
  usage_count: number
  last_used_at?: string
  order_index: number
  created_at: string
  updated_at: string
}

export type PhraseCategory =
  | 'greeting'      // 问候
  | 'need'          // 需求
  | 'emotion'        // 情绪
  | 'medical'        // 就医
  | 'shopping'       // 购物
  | 'dining'         // 点餐
  | 'transport'      // 打车/交通
  | 'custom'         // 自定义

export interface PhraseCategoryInfo {
  id: PhraseCategory
  name: string
  icon: string
  description: string
  color: string
}

export const PHRASE_CATEGORIES: Record<PhraseCategory, PhraseCategoryInfo> = {
  greeting: {
    id: 'greeting',
    name: '问候',
    icon: '👋',
    description: '日常问候语',
    color: 'bg-blue-100 text-blue-700',
  },
  need: {
    id: 'need',
    name: '需求',
    icon: '💡',
    description: '表达需求',
    color: 'bg-amber-100 text-amber-700',
  },
  emotion: {
    id: 'emotion',
    name: '情绪',
    icon: '❤️',
    description: '表达情绪',
    color: 'bg-pink-100 text-pink-700',
  },
  medical: {
    id: 'medical',
    name: '就医',
    icon: '🏥',
    description: '医疗相关',
    color: 'bg-red-100 text-red-700',
  },
  shopping: {
    id: 'shopping',
    name: '购物',
    icon: '🛒',
    description: '购物相关',
    color: 'bg-green-100 text-green-700',
  },
  dining: {
    id: 'dining',
    name: '点餐',
    icon: '🍽️',
    description: '点餐相关',
    color: 'bg-orange-100 text-orange-700',
  },
  transport: {
    id: 'transport',
    name: '交通',
    icon: '🚗',
    description: '打车/交通',
    color: 'bg-purple-100 text-purple-700',
  },
  custom: {
    id: 'custom',
    name: '自定义',
    icon: '⭐',
    description: '自定义短语',
    color: 'bg-gray-100 text-gray-700',
  },
}

// 预设短语已移至数据库 preset_phrases 表
// 通过 API /api/phrases/presets/initialize 初始化

export interface CreatePhraseDTO {
  text: string
  category: PhraseCategory
}

export interface UpdatePhraseDTO {
  text?: string
  category?: PhraseCategory
  order_index?: number
}

export interface PhraseUsageUpdate {
  phrase_id: string
  last_used_at: string
}
