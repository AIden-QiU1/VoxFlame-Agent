/**
 * VoxFlame 应用配置
 *
 * 支持两种访问模式：
 * 1. 直接访问 - localhost:3000 或 公网IP:3000
 * 2. 环境变量覆盖 - 通过 NEXT_PUBLIC_*_URL 指定
 */

// 获取当前主机名用于动态配置
function getHost(): string {
  if (typeof window === 'undefined') {
    return 'localhost'
  }
  return window.location.hostname
}

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) {
    return trimmed
  }

  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

function isLoopbackApiUrl(value: string): boolean {
  return /^https?:\/\/(localhost|127(?:\.\d{1,3}){3})(?::\d+)?\/api$/i.test(value)
}

function normalizeRtcExecutionBackend(
  value: string | undefined,
): 'livekit' | undefined {
  return value === 'livekit' ? value : undefined
}

export const config = {
  // API 端点配置
  api: {
    /**
     * 后端 API 地址
     * 用于 RTC orchestration、用户配置、工具执行、记忆管理
     * - 直接访问模式：使用绝对 URL 指向后端
     * - 环境变量：优先使用配置的 URL
     */
    get baseUrl(): string {
      const envUrl = process.env.NEXT_PUBLIC_API_URL
      if (envUrl) {
        const normalizedEnvUrl = normalizeApiBaseUrl(envUrl)

        // Remote clients cannot reach their own localhost:3001 when the app is
        // deployed on another machine, so fall back to the current origin.
        if (
          typeof window !== 'undefined' &&
          isLoopbackApiUrl(normalizedEnvUrl) &&
          getHost() !== 'localhost' &&
          getHost() !== '127.0.0.1'
        ) {
          return '/api'
        }

        // Even on localhost, prefer same-origin /api and let Next rewrites
        // proxy to backend. This avoids depending on host-visible 3001.
        if (
          typeof window !== 'undefined' &&
          isLoopbackApiUrl(normalizedEnvUrl)
        ) {
          return '/api'
        }

        return normalizedEnvUrl
      }

      // 默认全部走同源 /api，由 Next rewrite 转到 backend 容器。
      return '/api'
    },
  },

  rtc: {
    /**
     * 运行时执行面已完全收口到 `livekit`。
     */
    get executionBackend(): 'livekit' | undefined {
      return normalizeRtcExecutionBackend(
        process.env.NEXT_PUBLIC_RTC_EXECUTION_BACKEND,
      ) ?? 'livekit'
    },
  },

  // 音频配置 - 固定 16kHz PCM
  audio: {
    sampleRate: 16000,
    bufferSize: 4096,
    ttsSampleRate: 16000,  // 与后端 TTS 一致
  }
}
