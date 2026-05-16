'use client'

const STORAGE_KEY = 'voxflame_preferred_microphone_v1'
export const DEFAULT_MICROPHONE_DEVICE_ID = 'default'

export interface PreferredMicrophoneDevice {
  deviceId: string
  label: string
  updatedAt: string
}

export interface MicrophoneDeviceOption {
  deviceId: string
  label: string
  isDefault: boolean
}

export interface RecordingInputDeviceMetadata {
  deviceId?: string
  label?: string
  selectedDeviceId?: string
  selectedLabel?: string
  isSystemDefault: boolean
}

const BASE_AUDIO_CONSTRAINTS = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
} as const

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function normalizeDeviceId(deviceId: string | null | undefined): string {
  const trimmed = deviceId?.trim()
  return trimmed || DEFAULT_MICROPHONE_DEVICE_ID
}

export function readPreferredMicrophoneDevice(): PreferredMicrophoneDevice | null {
  if (!canUseBrowserStorage()) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<PreferredMicrophoneDevice>
    if (typeof parsed.deviceId !== 'string' || !parsed.deviceId.trim()) {
      return null
    }

    return {
      deviceId: normalizeDeviceId(parsed.deviceId),
      label: typeof parsed.label === 'string' && parsed.label.trim()
        ? parsed.label.trim()
        : '系统默认麦克风',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function savePreferredMicrophoneDevice(input: {
  deviceId: string
  label: string
}): PreferredMicrophoneDevice {
  const preference: PreferredMicrophoneDevice = {
    deviceId: normalizeDeviceId(input.deviceId),
    label: input.label.trim() || '系统默认麦克风',
    updatedAt: new Date().toISOString(),
  }

  if (canUseBrowserStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference))
  }

  return preference
}

export function clearPreferredMicrophoneDevice(): void {
  if (canUseBrowserStorage()) {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}

export function buildMicrophoneConstraints(
  preferredDeviceId: string | null | undefined = readPreferredMicrophoneDevice()?.deviceId,
): MediaTrackConstraints {
  const normalizedDeviceId = normalizeDeviceId(preferredDeviceId)

  if (normalizedDeviceId === DEFAULT_MICROPHONE_DEVICE_ID) {
    return BASE_AUDIO_CONSTRAINTS
  }

  return {
    ...BASE_AUDIO_CONSTRAINTS,
    deviceId: { exact: normalizedDeviceId },
  }
}

export async function listMicrophoneDevices(): Promise<MicrophoneDeviceOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return []
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => {
      const deviceId = normalizeDeviceId(device.deviceId)
      return {
        deviceId,
        label: device.label || (deviceId === DEFAULT_MICROPHONE_DEVICE_ID
          ? '系统默认麦克风'
          : `麦克风 ${index + 1}`),
        isDefault: deviceId === DEFAULT_MICROPHONE_DEVICE_ID,
      }
    })
}

export function getRecordingInputDeviceMetadata(
  track: MediaStreamTrack | null | undefined,
  selected: PreferredMicrophoneDevice | null = readPreferredMicrophoneDevice(),
): RecordingInputDeviceMetadata {
  const settings = track?.getSettings()
  const selectedDeviceId = selected?.deviceId ?? DEFAULT_MICROPHONE_DEVICE_ID

  return {
    deviceId: typeof settings?.deviceId === 'string' ? settings.deviceId : undefined,
    label: track?.label || undefined,
    selectedDeviceId,
    selectedLabel: selected?.label,
    isSystemDefault: selectedDeviceId === DEFAULT_MICROPHONE_DEVICE_ID,
  }
}
