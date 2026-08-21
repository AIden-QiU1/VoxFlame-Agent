export interface QuickExpressionPhrase {
  id: string
  text: string
}

export const QUICK_EXPRESSION_PHRASES: QuickExpressionPhrase[] = [
  { id: 'yes', text: '是的。' },
  { id: 'no', text: '不是。' },
  { id: 'repeat', text: '请再说一遍。' },
  { id: 'write', text: '如果你没听清，请写给我看。' },
  { id: 'one-by-one', text: '请一个问题一个问题问我。' },
  { id: 'slow-down', text: '请慢一点，我需要一点时间。' },
]
