import type { MobilePreparedExpressionSnapshot } from '../contracts/workspace-read-model'
import type { MobileTrainingExercise } from './training-catalog'

export function buildMobilePreparedMaterialExercises(
  prepared: MobilePreparedExpressionSnapshot | null,
): MobileTrainingExercise[] {
  if (!prepared) return []
  const sourceLines = (prepared.practice_lines?.length ?? 0) > 0
    ? prepared.practice_lines
    : prepared.sections.flatMap((section) => (
      [section.anchor_line, ...section.practice_lines].map((text, index) => ({
        id: `${prepared.id}:${section.id}:${index}`,
        text,
      }))
    ))
  return sourceLines.filter((line) => line.text.trim()).map((line) => ({
    id: line.id,
    text: line.text,
    category: '自定义材料',
  }))
}
