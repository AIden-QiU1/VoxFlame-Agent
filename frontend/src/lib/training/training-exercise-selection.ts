export type TrainingExerciseSelectionStage = 'unrecorded' | 'unrepeated' | 'revisit'

export interface TrainingExerciseLike {
  id: string
}

export interface SelectTrainingExercisesOptions<TExercise extends TrainingExerciseLike> {
  exercises: TExercise[]
  recordedExerciseIds?: Iterable<string>
  sessionExerciseIds?: Iterable<string>
}

export interface SelectedTrainingExercises<TExercise extends TrainingExerciseLike> {
  exercises: TExercise[]
  stage: TrainingExerciseSelectionStage
  unrecordedCount: number
  unrepeatedCount: number
  totalCount: number
}

function toIdSet(values?: Iterable<string>): Set<string> {
  const results = new Set<string>()

  if (!values) {
    return results
  }

  for (const value of Array.from(values)) {
    const normalized = value.trim()
    if (!normalized) {
      continue
    }

    results.add(normalized)
  }

  return results
}

export function selectTrainingExercises<TExercise extends TrainingExerciseLike>(
  options: SelectTrainingExercisesOptions<TExercise>,
): SelectedTrainingExercises<TExercise> {
  const recordedExerciseIds = toIdSet(options.recordedExerciseIds)
  const sessionExerciseIds = toIdSet(options.sessionExerciseIds)
  const completedExerciseIds = new Set<string>([
    ...Array.from(recordedExerciseIds),
    ...Array.from(sessionExerciseIds),
  ])

  const unrecordedExercises = options.exercises.filter(
    (exercise) => !completedExerciseIds.has(exercise.id),
  )
  const unrepeatedExercises = options.exercises.filter(
    (exercise) => !sessionExerciseIds.has(exercise.id),
  )

  if (unrecordedExercises.length > 0) {
    return {
      exercises: unrecordedExercises,
      stage: 'unrecorded',
      unrecordedCount: unrecordedExercises.length,
      unrepeatedCount: unrepeatedExercises.length,
      totalCount: options.exercises.length,
    }
  }

  if (unrepeatedExercises.length > 0) {
    return {
      exercises: unrepeatedExercises,
      stage: 'unrepeated',
      unrecordedCount: 0,
      unrepeatedCount: unrepeatedExercises.length,
      totalCount: options.exercises.length,
    }
  }

  return {
    exercises: options.exercises,
    stage: 'revisit',
    unrecordedCount: 0,
    unrepeatedCount: 0,
    totalCount: options.exercises.length,
  }
}
