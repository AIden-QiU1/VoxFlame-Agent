import type { MandarinTrainingCategory, MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'
import type {
  PreparedExpressionSectionSnapshot,
  PreparedExpressionSnapshot,
} from '@/lib/memory/workspace-snapshot'

export interface PreparedExpressionPracticeExercise extends MandarinTrainingExercise {
  practiceSource: 'prepared_expression'
  preparedExpressionId: string
  preparedExpressionTitle: string
  preparedExpressionSectionId: string
  preparedExpressionSectionTitle: string
  preparedExpressionSectionSummary: string
  preparedExpressionAnchorLine: string
  preparedExpressionKeywords: string[]
  preparedExpressionHighRiskPhrases: string[]
  preparedExpressionFallbackPhrases: string[]
  preparedExpressionPriority: boolean
}

export interface PreparedExpressionPracticeSummary {
  title: string
  summary: string
  rehearsalCount: number
  lowConfidenceSections: number
  nextFocus: string[]
}

const DEFAULT_PREPARED_EXPRESSION_CATEGORY: MandarinTrainingCategory = '发音与朗读'
const TARGET_SEGMENT_MIN_LENGTH = 5
const TARGET_SEGMENT_MAX_LENGTH = 15
const CLAUSE_BREAK_PUNCTUATION = new Set(['，', '、', '：', ':', '；', ';', '。', '！', '？', '!', '?'])
const SOFT_SPLIT_HINTS = ['如果', '但是', '因为', '所以', '然后', '并且', '以及', '同时', '或者', '比如', '例如', '为了']
const NORMALIZE_PATTERN = /[\s,.;:!?，。！？；：、"'“”‘’（）()【】[\]{}<>《》…—-]+/g

interface DocumentParagraph {
  text: string
  index: number
}

interface PreparedExpressionSectionResolver {
  section: PreparedExpressionSectionSnapshot
  candidates: string[]
}

function dedupeStrings(values: string[], limit?: number): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  for (const value of values) {
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    results.push(normalized)

    if (typeof limit === 'number' && results.length >= limit) {
      break
    }
  }

  return results
}

function normalizeForMatch(value: string): string {
  return value.replace(NORMALIZE_PATTERN, '').trim().toLowerCase()
}

function normalizeDocumentContent(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

function measureSegmentLength(value: string): number {
  return normalizeForMatch(value).length
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function splitDocumentParagraphs(content: string): DocumentParagraph[] {
  const normalized = normalizeDocumentContent(content)
  if (!normalized) {
    return []
  }

  return normalized
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph, index) => ({
      text: paragraph,
      index,
    }))
}

function splitIntoClauses(text: string): string[] {
  const normalized = text.trim()
  if (!normalized) {
    return []
  }

  const clauses: string[] = []
  let current = ''

  for (const char of normalized) {
    current += char
    if (CLAUSE_BREAK_PUNCTUATION.has(char)) {
      const clause = current.trim()
      if (clause) {
        clauses.push(clause)
      }
      current = ''
    }
  }

  const tail = current.trim()
  if (tail) {
    clauses.push(tail)
  }

  return clauses
}

function splitTrailingPunctuation(value: string): { core: string; suffix: string } {
  const match = value.match(/^(.*?)([，。、！？；：:;!?]*)$/)
  if (!match) {
    return {
      core: value,
      suffix: '',
    }
  }

  return {
    core: match[1]?.trim() || '',
    suffix: match[2] || '',
  }
}

function findPreferredSplitIndex(text: string): number {
  const upperBound = Math.min(TARGET_SEGMENT_MAX_LENGTH, text.length - 1)
  const lowerBound = Math.min(TARGET_SEGMENT_MIN_LENGTH, upperBound)

  for (let index = upperBound; index >= lowerBound; index -= 1) {
    const previousChar = text[index - 1]
    if (previousChar && CLAUSE_BREAK_PUNCTUATION.has(previousChar)) {
      return index
    }
  }

  for (let index = upperBound; index >= lowerBound; index -= 1) {
    const prefix = text.slice(0, index)
    if (SOFT_SPLIT_HINTS.some((hint) => prefix.endsWith(hint))) {
      return index
    }
  }

  return upperBound
}

function splitLongClause(clause: string): string[] {
  const normalized = clause.trim()
  if (!normalized) {
    return []
  }

  const { core, suffix } = splitTrailingPunctuation(normalized)
  const chunks: string[] = []
  let remaining = core

  while (measureSegmentLength(remaining) > TARGET_SEGMENT_MAX_LENGTH) {
    const splitIndex = findPreferredSplitIndex(remaining)
    const head = remaining.slice(0, splitIndex).trim()
    const tail = remaining.slice(splitIndex).trim()

    if (!head || !tail) {
      break
    }

    chunks.push(head)
    remaining = tail
  }

  const tailChunk = remaining.trim()
  if (tailChunk) {
    chunks.push(tailChunk)
  }

  if (suffix && chunks.length > 0) {
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}${suffix}`
  }

  return chunks.filter((chunk) => chunk.length > 0)
}

function mergeClausesIntoPracticeLines(clauses: string[]): string[] {
  const results: string[] = []
  let current = ''

  clauses.forEach((rawClause) => {
    const clause = rawClause.trim()
    if (!clause) {
      return
    }

    const segments =
      measureSegmentLength(clause) > TARGET_SEGMENT_MAX_LENGTH
        ? splitLongClause(clause)
        : [clause]

    segments.forEach((segment) => {
      if (!current) {
        current = segment
        return
      }

      const combined = `${current}${segment}`.trim()
      if (
        measureSegmentLength(current) < TARGET_SEGMENT_MIN_LENGTH ||
        measureSegmentLength(combined) <= TARGET_SEGMENT_MAX_LENGTH
      ) {
        current = combined
        return
      }

      results.push(current)
      current = segment
    })
  })

  if (current) {
    if (
      results.length > 0 &&
      measureSegmentLength(current) < TARGET_SEGMENT_MIN_LENGTH
    ) {
      results[results.length - 1] = `${results[results.length - 1]}${current}`
    } else {
      results.push(current)
    }
  }

  return results
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
}

function splitParagraphIntoPracticeLines(paragraph: string): string[] {
  return mergeClausesIntoPracticeLines(splitIntoClauses(paragraph))
}

function matchesCandidate(text: string, candidate: string): boolean {
  const normalizedText = normalizeForMatch(text)
  const normalizedCandidate = normalizeForMatch(candidate)

  if (!normalizedText || !normalizedCandidate) {
    return false
  }

  if (normalizedText === normalizedCandidate) {
    return true
  }

  if (normalizedText.length >= 6 && normalizedCandidate.includes(normalizedText)) {
    return true
  }

  if (normalizedCandidate.length >= 6 && normalizedText.includes(normalizedCandidate)) {
    return true
  }

  return false
}

function buildSectionResolvers(
  preparedExpression: PreparedExpressionSnapshot,
): PreparedExpressionSectionResolver[] {
  return preparedExpression.sections.map((section) => ({
    section,
    candidates: dedupeStrings([
      section.anchor_line,
      ...section.practice_lines,
    ]),
  }))
}

function resolveSectionForSegment(
  segment: string,
  paragraph: string,
  sectionResolvers: PreparedExpressionSectionResolver[],
): PreparedExpressionSectionSnapshot | null {
  const directMatch = sectionResolvers.find((resolver) => (
    resolver.candidates.some((candidate) => matchesCandidate(segment, candidate))
  ))
  if (directMatch) {
    return directMatch.section
  }

  const paragraphMatch = sectionResolvers.find((resolver) => (
    resolver.candidates.some((candidate) => matchesCandidate(paragraph, candidate))
  ))
  return paragraphMatch?.section ?? null
}

function buildSyntheticSectionTitle(paragraph: string, index: number): string {
  const firstLine = splitParagraphIntoPracticeLines(paragraph)[0] ?? paragraph
  const normalized = firstLine
    .replace(/[：:]/g, ' ')
    .replace(/[，。！？!?、；;]/g, ' ')
    .trim()

  return normalized ? truncateText(normalized, 16) : `第 ${index + 1} 段`
}

function selectParagraphMatches(
  paragraph: string,
  phrases: string[],
  limit: number,
): string[] {
  return dedupeStrings(
    phrases.filter((phrase) => {
      const normalized = phrase.trim()
      return normalized.length > 0 && paragraph.includes(normalized)
    }),
    limit,
  )
}

function buildFallbackSectionExercises(
  preparedExpression: PreparedExpressionSnapshot,
): PreparedExpressionPracticeExercise[] {
  return preparedExpression.sections.flatMap((section) => {
    const lines = dedupeStrings([
      section.anchor_line,
      ...section.practice_lines,
    ])

    return lines.map((line, index) => ({
      id: `${preparedExpression.id}:${section.id}:${index}`,
      text: line,
      category: DEFAULT_PREPARED_EXPRESSION_CATEGORY,
      practiceSource: 'prepared_expression',
      preparedExpressionId: preparedExpression.id,
      preparedExpressionTitle: preparedExpression.title,
      preparedExpressionSectionId: section.id,
      preparedExpressionSectionTitle: section.title,
      preparedExpressionSectionSummary: section.summary,
      preparedExpressionAnchorLine: section.anchor_line,
      preparedExpressionKeywords: dedupeStrings([
        ...section.hotwords,
        ...preparedExpression.hotwords,
      ], 8),
      preparedExpressionHighRiskPhrases: dedupeStrings(section.high_risk_phrases, 6),
      preparedExpressionFallbackPhrases: dedupeStrings(section.fallback_phrases, 4),
      preparedExpressionPriority: section.is_priority,
    }))
  })
}

export function buildPreparedExpressionPracticeExercises(
  preparedExpression: PreparedExpressionSnapshot | null | undefined,
): PreparedExpressionPracticeExercise[] {
  if (!preparedExpression) {
    return []
  }

  const documentParagraphs = splitDocumentParagraphs(preparedExpression.document_content)
  if (documentParagraphs.length === 0) {
    return buildFallbackSectionExercises(preparedExpression)
  }

  const sectionResolvers = buildSectionResolvers(preparedExpression)
  let exerciseIndex = 0

  return documentParagraphs.flatMap((paragraph) => {
    const practiceLines = splitParagraphIntoPracticeLines(paragraph.text)

    return practiceLines.map((line) => {
      const matchedSection = resolveSectionForSegment(line, paragraph.text, sectionResolvers)
      const sectionId = matchedSection?.id ?? `document-paragraph-${paragraph.index + 1}`
      const sectionTitle = matchedSection?.title ?? buildSyntheticSectionTitle(paragraph.text, paragraph.index)
      const sectionSummary = matchedSection?.summary ?? truncateText(paragraph.text, 40)
      const anchorLine = matchedSection?.anchor_line ?? paragraph.text
      const keywords = matchedSection
        ? dedupeStrings([
          ...matchedSection.hotwords,
          ...preparedExpression.hotwords,
        ], 8)
        : dedupeStrings([
          ...selectParagraphMatches(paragraph.text, preparedExpression.hotwords, 8),
          ...preparedExpression.hotwords,
        ], 8)
      const highRiskPhrases = matchedSection
        ? dedupeStrings(matchedSection.high_risk_phrases, 6)
        : selectParagraphMatches(paragraph.text, preparedExpression.high_risk_phrases, 6)
      const fallbackPhrases = matchedSection
        ? dedupeStrings(matchedSection.fallback_phrases, 4)
        : selectParagraphMatches(paragraph.text, preparedExpression.fallback_phrases, 4)
      const isPriority = matchedSection?.is_priority ?? false

      const exercise: PreparedExpressionPracticeExercise = {
        id: `${preparedExpression.id}:${sectionId}:${exerciseIndex}`,
        text: line,
        category: DEFAULT_PREPARED_EXPRESSION_CATEGORY,
        practiceSource: 'prepared_expression',
        preparedExpressionId: preparedExpression.id,
        preparedExpressionTitle: preparedExpression.title,
        preparedExpressionSectionId: sectionId,
        preparedExpressionSectionTitle: sectionTitle,
        preparedExpressionSectionSummary: sectionSummary,
        preparedExpressionAnchorLine: anchorLine,
        preparedExpressionKeywords: keywords,
        preparedExpressionHighRiskPhrases: highRiskPhrases,
        preparedExpressionFallbackPhrases: fallbackPhrases,
        preparedExpressionPriority: isPriority,
      }

      exerciseIndex += 1
      return exercise
    })
  })
}

export function buildPreparedExpressionPracticeSummary(
  preparedExpression: PreparedExpressionSnapshot | null | undefined,
): PreparedExpressionPracticeSummary | null {
  if (!preparedExpression) {
    return null
  }

  return {
    title: preparedExpression.title,
    summary: preparedExpression.summary,
    rehearsalCount: preparedExpression.rehearsal_count,
    lowConfidenceSections: preparedExpression.low_confidence_sections,
    nextFocus: preparedExpression.next_focus,
  }
}
