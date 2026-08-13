import type { MobilePreparedExpressionSnapshot } from '../contracts/workspace-read-model'
import type { MobileTrainingExercise } from './training-catalog'

const BREAKS = new Set(['，', '、', '：', ':', '；', ';', '。', '！', '？', '!', '?'])
const MIN_LENGTH = 10
const MAX_LENGTH = 20

function semanticLength(text: string): number {
  return text.replace(/[\s，。！？、；：“”‘’（）()]/g, '').length
}

function splitClauses(text: string): string[] {
  const clauses: string[] = []
  let current = ''
  for (const char of text.trim()) {
    current += char
    if (BREAKS.has(char)) {
      if (current.trim()) clauses.push(current.trim())
      current = ''
    }
  }
  if (current.trim()) clauses.push(current.trim())
  return clauses
}

function splitLong(text: string): string[] {
  const chars = Array.from(text)
  const result: string[] = []
  for (let offset = 0; offset < chars.length; offset += MAX_LENGTH) {
    result.push(chars.slice(offset, offset + MAX_LENGTH).join('').trim())
  }
  return result.filter(Boolean)
}

export function buildMobilePreparedMaterialExercises(
  prepared: MobilePreparedExpressionSnapshot | null,
): MobileTrainingExercise[] {
  if (!prepared) return []
  const paragraphs = prepared.document_content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const lines: string[] = []

  paragraphs.forEach((paragraph) => {
    let current = ''
    splitClauses(paragraph).forEach((clause) => {
      if (semanticLength(clause) > MAX_LENGTH) {
        if (current) lines.push(current)
        lines.push(...splitLong(clause))
        current = ''
        return
      }
      const combined = `${current}${clause}`
      if (!current || semanticLength(current) < MIN_LENGTH || semanticLength(combined) <= MAX_LENGTH) {
        current = combined
      } else {
        lines.push(current)
        current = clause
      }
    })
    if (current) lines.push(current)
  })

  const sourceLines = lines.length > 0
    ? lines
    : prepared.sections.flatMap((section) => [section.anchor_line, ...section.practice_lines])
  return sourceLines.filter(Boolean).map((text, index) => ({
    id: `${prepared.id}:mobile:${index}`,
    text,
    category: '自定义材料',
  }))
}
