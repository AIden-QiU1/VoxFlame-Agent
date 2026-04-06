'use client'

import { useEffect, useState } from 'react'

export type MicrophoneInputQuality = 'inactive' | 'quiet' | 'balanced' | 'loud'

export interface MicrophoneInputFeedback {
  level: number
  quality: MicrophoneInputQuality
  label: string
  hint: string
}

const QUIET_THRESHOLD = 0.035
const LOUD_THRESHOLD = 0.18

export function calculateNormalizedInputLevel(data: Uint8Array): number {
  if (data.length === 0) {
    return 0
  }

  let sum = 0
  for (let index = 0; index < data.length; index += 1) {
    const sample = (data[index] - 128) / 128
    sum += sample * sample
  }

  return Math.sqrt(sum / data.length)
}

export function classifyMicrophoneInputFeedback(
  level: number,
  active: boolean,
): MicrophoneInputFeedback {
  if (!active) {
    return {
      level: 0,
      quality: 'inactive',
      label: '待机中',
      hint: '连接后先试着说一句，系统会检查你的收音状态。',
    }
  }

  if (level < QUIET_THRESHOLD) {
    return {
      level,
      quality: 'quiet',
      label: '声音偏小',
      hint: '把麦克风靠近一点，先把第一句完整送出来。',
    }
  }

  if (level > LOUD_THRESHOLD) {
    return {
      level,
      quality: 'loud',
      label: '声音过冲',
      hint: '稍微离麦克风远一点，避免爆音把关键词冲糊。',
    }
  }

  return {
    level,
    quality: 'balanced',
    label: '收音稳定',
    hint: '现在的收音比较合适，继续保持这个距离和音量。',
  }
}

export function useMicrophoneInputFeedback(
  analyser: AnalyserNode | null,
  active: boolean,
): MicrophoneInputFeedback {
  const [feedback, setFeedback] = useState<MicrophoneInputFeedback>(() =>
    classifyMicrophoneInputFeedback(0, false),
  )

  useEffect(() => {
    if (!analyser || !active) {
      setFeedback(classifyMicrophoneInputFeedback(0, false))
      return
    }

    let animationFrame: number | null = null
    const bufferLength = analyser.frequencyBinCount
    const data = new Uint8Array(bufferLength)

    const update = () => {
      analyser.getByteTimeDomainData(data)
      const level = calculateNormalizedInputLevel(data)
      setFeedback(classifyMicrophoneInputFeedback(level, true))
      animationFrame = window.requestAnimationFrame(update)
    }

    update()

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
    }
  }, [active, analyser])

  return feedback
}
