import type { MandarinTrainingCategory, MandarinTrainingExercise } from '@/lib/corpus/mandarin-training'
import type { PreparedExpressionSnapshot } from '@/lib/memory/workspace-snapshot'

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

export function buildPreparedExpressionPracticeExercises(
  preparedExpression: PreparedExpressionSnapshot | null | undefined,
): PreparedExpressionPracticeExercise[] {
  if (!preparedExpression) {
    return []
  }

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
