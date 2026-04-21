function semanticLength(text: string): number {
  return text.replace(/^[\s，。！？!?；;：:、,.…~～-]+|[\s，。！？!?；;：:、,.…~～-]+$/g, '').length
}

interface TrainingTranscriptCandidateInput {
  baseline: string
  latestFinal: string
  latestInterim: string
  bestObserved: string
}

export function pickPreferredTrainingTranscriptCandidate(
  input: TrainingTranscriptCandidateInput,
): string {
  const baseline = input.baseline.trim()
  const latestFinal = input.latestFinal.trim()
  const latestInterim = input.latestInterim.trim()
  const bestObserved = input.bestObserved.trim()

  if (latestFinal && latestFinal !== baseline) {
    return latestFinal
  }

  if (
    bestObserved
    && semanticLength(bestObserved) > 0
    && semanticLength(bestObserved) >= semanticLength(latestInterim)
  ) {
    return bestObserved
  }

  if (latestInterim) {
    return latestInterim
  }

  return latestFinal !== baseline ? latestFinal : ''
}
