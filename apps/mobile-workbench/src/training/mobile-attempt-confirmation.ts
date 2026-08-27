export type MobileAttemptConfirmationResult = 'confirmed' | 'kept'

export type MobileAttemptDiscardResult = 'discarded' | 'kept'

export type MobileAttemptReplacementResult =
  | 'replacement_started'
  | 'discard_failed'
  | 'start_failed'

export async function confirmMobileTrainingAttempt(
  upload: () => Promise<unknown | null>,
): Promise<MobileAttemptConfirmationResult> {
  return await upload() ? 'confirmed' : 'kept'
}

export async function discardMobileTrainingAttempt(
  discard: () => Promise<boolean>,
): Promise<MobileAttemptDiscardResult> {
  return await discard() ? 'discarded' : 'kept'
}

/** Strict replacement never starts a new take until the previous take is gone. */
export async function replaceMobileTrainingAttempt(
  discard: () => Promise<boolean>,
  start: () => Promise<boolean>,
): Promise<MobileAttemptReplacementResult> {
  const discarded = await discard()
  if (!discarded) return 'discard_failed'

  return await start() ? 'replacement_started' : 'start_failed'
}
