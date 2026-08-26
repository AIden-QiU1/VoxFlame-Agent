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

const DEFAULT_PREPARED_EXPRESSION_CATEGORY: MandarinTrainingCategory = '现代文章朗读'

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

  if ((preparedExpression.practice_lines?.length ?? 0) > 0) {
    return preparedExpression.practice_lines.map((line) => {
      const section = preparedExpression.sections.find((item) => item.id === line.section_id)
      return {
        id: line.id,
        text: line.text,
        category: DEFAULT_PREPARED_EXPRESSION_CATEGORY,
        practiceSource: 'prepared_expression',
        preparedExpressionId: preparedExpression.id,
        preparedExpressionTitle: preparedExpression.title,
        preparedExpressionSectionId: line.section_id,
        preparedExpressionSectionTitle: line.section_title,
        preparedExpressionSectionSummary: section?.summary ?? line.section_title,
        preparedExpressionAnchorLine: section?.anchor_line ?? line.text,
        preparedExpressionKeywords: dedupeStrings([
          ...(section?.hotwords ?? []),
          ...preparedExpression.hotwords,
        ], 8),
        preparedExpressionHighRiskPhrases: dedupeStrings(section?.high_risk_phrases ?? [], 6),
        preparedExpressionFallbackPhrases: dedupeStrings(section?.fallback_phrases ?? [], 4),
        preparedExpressionPriority: section?.is_priority ?? false,
      }
    })
  }

  return buildFallbackSectionExercises(preparedExpression)
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
    nextFocus: preparedExpression.training_reports?.weekly_summary?.next_focus
      ?? preparedExpression.training_reports?.daily_summary?.next_focus
      ?? [],
  }
}
