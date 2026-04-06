import {
  applyAssistantResponseDelta,
  applyConnectedState,
  applyCorrectedSubtitle,
  applyCurrentAsrText,
  applyFinalAssistantTranscript,
  applyFinalUserTranscript,
  applyRtcError,
  applyTrainingFeedback,
  applyVoiceProfileSync,
} from './session-state'
import type {
  ConversationMessage,
  RtcAgentState,
  RtcMessageEnvelope,
  RtmMessageEvent,
  SessionControlClient,
  StartRtcSessionResponse,
  TrainingFeedbackEvent,
  VoiceProfileSyncEvent,
} from './session-types'

export interface ChunkAccumulator {
  createdAt: number
  totalParts: number
  parts: Map<number, string>
}

export interface SessionMemoryTurn {
  role: Extract<ConversationMessage['role'], 'user' | 'assistant'>
  content: string
}

const RTM_PUBLISH_OPTIONS = {
  channelType: 'MESSAGE' as const,
}

const RTM_CHUNK_TTL_MS = 15_000

function parseEnvelope(text: string): RtcMessageEnvelope | null {
  try {
    const parsed = JSON.parse(text) as RtcMessageEnvelope
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function cleanupExpiredChunks(chunks: Map<string, ChunkAccumulator>, now: number): void {
  const expiredMessageIds: string[] = []
  chunks.forEach((chunk, messageId) => {
    if (now - chunk.createdAt > RTM_CHUNK_TTL_MS) {
      expiredMessageIds.push(messageId)
    }
  })
  expiredMessageIds.forEach((messageId) => {
    chunks.delete(messageId)
  })
}

function decodeBase64Utf8(content: string): string {
  const binary = window.atob(content)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function maybeAssembleChunkedMessage(
  rawText: string,
  chunks: Map<string, ChunkAccumulator>,
): string | null | undefined {
  const separatorIndex = rawText.indexOf('|')
  if (separatorIndex <= 0) {
    return undefined
  }

  const [messageId, partIndexRaw, totalPartsRaw, content] = rawText.split('|', 4)
  const partIndex = Number.parseInt(partIndexRaw, 10)
  const totalParts = Number.parseInt(totalPartsRaw, 10)

  if (!messageId || !content || !Number.isInteger(partIndex) || !Number.isInteger(totalParts)) {
    return undefined
  }

  const now = Date.now()
  cleanupExpiredChunks(chunks, now)

  const current =
    chunks.get(messageId) ??
    {
      createdAt: now,
      totalParts,
      parts: new Map<number, string>(),
    }

  current.parts.set(partIndex, content)
  current.totalParts = totalParts
  chunks.set(messageId, current)

  if (current.parts.size < totalParts) {
    return null
  }

  const ordered: string[] = []
  for (let index = 1; index <= totalParts; index += 1) {
    const part = current.parts.get(index)
    if (!part) {
      return null
    }
    ordered.push(part)
  }

  chunks.delete(messageId)
  return decodeBase64Utf8(ordered.join(''))
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function decodeInboundMessage(
  message: string | Uint8Array,
  chunks: Map<string, ChunkAccumulator>,
): RtcMessageEnvelope | null {
  const text =
    typeof message === 'string' ? message : new TextDecoder().decode(message)

  const directEnvelope = parseEnvelope(text)
  if (directEnvelope) {
    return directEnvelope
  }

  const maybeChunked = maybeAssembleChunkedMessage(text, chunks)
  if (maybeChunked === undefined || maybeChunked === null) {
    return null
  }

  return parseEnvelope(maybeChunked)
}

export async function publishSessionEnvelope(
  rtmClient: SessionControlClient,
  session: StartRtcSessionResponse,
  payload: Record<string, unknown>,
): Promise<void> {
  await rtmClient.publish(
    session.rtmChannelName || session.channelName,
    JSON.stringify(payload),
    RTM_PUBLISH_OPTIONS,
  )
}

export async function publishSessionControlMessage({
  rtmClient,
  session,
  type,
  payload = {},
}: {
  rtmClient: SessionControlClient
  session: StartRtcSessionResponse
  type: string
  payload?: Record<string, unknown>
}): Promise<void> {
  const clientId = String(session.userUid)

  await publishSessionEnvelope(rtmClient, session, {
    type,
    client_id: clientId,
    session_id: session.channelName,
    metadata: {
      client_id: clientId,
      session_id: session.channelName,
      transport: 'livekit_data',
      mode: session.intent.mode,
      surface: session.intent.surface,
      session_strategy: session.intent.sessionStrategy,
    },
    timestamp: Date.now(),
    ...payload,
  })
}

export function extractMemoryTurnsFromEnvelope(
  message: RtcMessageEnvelope,
): SessionMemoryTurn[] {
  if (message.type !== 'transcript' || !message.text || !message.is_final) {
    return []
  }

  if (message.role === 'user' || message.role === 'assistant') {
    return [
      {
        role: message.role,
        content: message.text,
      },
    ]
  }

  return []
}

export function extractLatestUserTranscriptFromEnvelope(
  message: RtcMessageEnvelope,
): string | null {
  if (message.type === 'transcript' && message.role === 'user' && message.is_final && message.text) {
    return message.text
  }

  return null
}

export function reduceRtcEnvelope(
  prev: RtcAgentState,
  message: RtcMessageEnvelope,
): RtcAgentState {
  if (message.type === 'training_feedback') {
    const feedback: TrainingFeedbackEvent = {
      requestId: message.feedback_request_id || '',
      exerciseId: message.exercise_id || '',
      exerciseText: message.exercise_text || '',
      recognizedText: message.recognized_text || '',
      status: message.feedback_status || 'unclear',
      category: message.exercise_category || '',
      clarityScore:
        typeof message.clarity_score === 'number' ? Math.round(message.clarity_score * 100) : 0,
      summary: message.summary || '',
      focusTags: readStringList(message.focus_tags),
      keywords: readStringList(message.keywords),
      confusionPatternsCount:
        typeof message.confusion_patterns_count === 'number' ? message.confusion_patterns_count : 0,
      pronunciationSummary: message.pronunciation_summary || '',
      persisted: message.persisted === true,
      memoryEnabled: message.memory_enabled !== false,
      voiceProfileUpdateRequested: message.voice_profile_update_requested === true,
      voiceProfileUpdated: message.voice_profile_updated === true,
      encouragement: message.encouragement || '',
      primaryFocus: message.primary_focus || '',
      primaryPinyin: message.primary_pinyin || '',
      articulationTip: message.articulation_tip || '',
      nextStep: message.next_step || '',
      source: typeof message.source === 'string' ? message.source : 'unknown',
      timestamp: new Date(),
      error: typeof message.error === 'string' ? message.error : null,
      voiceProfileError:
        typeof message.metadata?.voice_profile_error === 'string'
          ? message.metadata.voice_profile_error
          : null,
    }
    return applyTrainingFeedback(prev, feedback)
  }

  if (message.type === 'voice_profile_updated') {
    const sync: VoiceProfileSyncEvent = {
      source: typeof message.source === 'string' ? message.source : 'unknown',
      exerciseId: message.exercise_id || '',
      category: message.exercise_category || '',
      hotwordCount: typeof message.hotword_count === 'number' ? message.hotword_count : 0,
      confusionPatternsCount:
        typeof message.confusion_patterns_count === 'number' ? message.confusion_patterns_count : 0,
      clarityScore:
        typeof message.clarity_score === 'number' ? Math.round(message.clarity_score * 100) : 0,
      lastTrainingCategory: message.last_training_category || '',
      timestamp: new Date(),
    }
    return applyVoiceProfileSync(prev, sync)
  }

  if (message.type === 'speech_activity') {
    if (message.state === 'barge_in_triggered') {
      return {
        ...prev,
        isSpeaking: false,
        isThinking: false,
      }
    }

    return prev
  }

  if (message.type === 'error' || message.error) {
    return applyRtcError(prev, message.error || message.message || 'RTC 会话出现错误')
  }

  if (message.type === 'transcript' && message.text) {
    const correctionOriginal =
      (typeof message.metadata?.original === 'string' && message.metadata.original) || ''
    const isCorrectionEvent = message.metadata?.type === 'correction'

    if (message.role === 'user' && message.is_final) {
      return applyFinalUserTranscript(prev, message.text)
    }

    if (message.role === 'assistant' && message.is_final) {
      return applyFinalAssistantTranscript(
        prev,
        message.text,
        isCorrectionEvent && correctionOriginal
          ? {
              originalText: correctionOriginal,
              correctedText: message.text,
              isCorrected: correctionOriginal !== message.text,
              timestamp: new Date(),
            }
          : null,
      )
    }

    if (message.role === 'user') {
      return applyCurrentAsrText(prev, message.text)
    }
  }

  if (message.name === 'interim_text') {
    const text = message.data?.text
    if (typeof text === 'string') {
      return applyCurrentAsrText(prev, text)
    }
    return prev
  }

  if (message.name === 'corrected_text') {
    const correctedText =
      (typeof message.data?.corrected_text === 'string' && message.data.corrected_text) ||
      message.corrected_text ||
      ''
    const originalText =
      (typeof message.data?.original_text === 'string' && message.data.original_text) ||
      message.original_text ||
      ''
    if (correctedText) {
      return applyCorrectedSubtitle(
        prev,
        originalText && correctedText && originalText !== correctedText
          ? {
              originalText,
              correctedText,
              isCorrected: true,
              timestamp: new Date(),
            }
          : null,
      )
    }
    return prev
  }

  if (message.name === 'text_data') {
    const delta =
      (typeof message.data?.text === 'string' && message.data.text) ||
      message.delta ||
      ''
    const isFinal =
      (typeof message.data?.is_final === 'boolean' && message.data.is_final) ||
      message.is_final ||
      false

    return applyAssistantResponseDelta(prev, delta, isFinal)
  }

  return prev
}

export function applyConnectedRtcSession(
  prev: RtcAgentState,
  session: StartRtcSessionResponse,
  connectionNotice: string | null,
): RtcAgentState {
  return applyConnectedState(prev, session, connectionNotice)
}

export function decodeInboundEnvelopeFromEvent(
  event: RtmMessageEvent,
  chunks: Map<string, ChunkAccumulator>,
): RtcMessageEnvelope | null {
  return decodeInboundMessage(event.message, chunks)
}
