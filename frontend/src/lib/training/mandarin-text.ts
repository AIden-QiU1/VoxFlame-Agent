const CHINESE_PUNCTUATION_REGEX = /[，。！？、；：“”‘’（）()\s]/g

export function normalizeChineseText(text: string): string {
  return text.replace(CHINESE_PUNCTUATION_REGEX, '').trim()
}
