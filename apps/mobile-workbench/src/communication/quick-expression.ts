export interface MobileQuickExpressionPhrase {
  id: string
  text: string
}

export const MOBILE_QUICK_EXPRESSION_PHRASES: MobileQuickExpressionPhrase[] = [
  { id: 'yes', text: '是的。' },
  { id: 'no', text: '不是。' },
  { id: 'repeat', text: '请再说一遍。' },
  { id: 'write', text: '如果你没听清，请写给我看。' },
  { id: 'one-by-one', text: '请一个问题一个问题问我。' },
  { id: 'slow-down', text: '请慢一点，我需要一点时间。' },
]

export function buildMobileQuickExpressionPhrases(
  savedPhrases: string[],
): MobileQuickExpressionPhrase[] {
  const phrases = [...MOBILE_QUICK_EXPRESSION_PHRASES]
  const seen = new Set(phrases.map((phrase) => phrase.text))

  savedPhrases.forEach((value, index) => {
    const text = value.trim()
    if (!text || seen.has(text)) {
      return
    }

    seen.add(text)
    phrases.push({ id: `saved-${index}`, text })
  })

  return phrases
}
