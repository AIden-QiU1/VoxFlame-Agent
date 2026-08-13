'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ArrowLeft, Mic, RotateCcw, Save } from 'lucide-react'
import { MicrophoneInputFeedback } from '@/components/runtime/MicrophoneInputFeedback'
import {
  DEFAULT_MICROPHONE_DEVICE_ID,
  buildMicrophoneConstraints,
  clearPreferredMicrophoneDevice,
  listMicrophoneDevices,
  readPreferredMicrophoneDevice,
  savePreferredMicrophoneDevice,
  type MicrophoneDeviceOption,
} from '@/lib/audio/microphone-preferences'
import { reportFrontendDiagnostic, toProductMessage } from '@/lib/ui/product-message'

type PermissionState = 'unknown' | 'ready' | 'error'

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop()
  })
}

export default function AudioSettingsPage() {
  const [devices, setDevices] = useState<MicrophoneDeviceOption[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(DEFAULT_MICROPHONE_DEVICE_ID)
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown')
  const [message, setMessage] = useState('先允许麦克风权限，再选择你实际会用的输入设备。')
  const [activeDeviceLabel, setActiveDeviceLabel] = useState('还没有开始测试')
  const [isTesting, setIsTesting] = useState(false)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const cleanupTest = useCallback(() => {
    sourceNodeRef.current?.disconnect()
    sourceNodeRef.current = null
    analyserRef.current?.disconnect()
    analyserRef.current = null
    setAnalyser(null)
    const audioContext = audioContextRef.current
    audioContextRef.current = null
    if (audioContext) {
      void audioContext.close().catch(() => undefined)
    }
    stopStream(streamRef.current)
    streamRef.current = null
    setIsTesting(false)
  }, [])

  const refreshDevices = useCallback(async () => {
    const nextDevices = await listMicrophoneDevices()
    setDevices(nextDevices)
    const preferred = readPreferredMicrophoneDevice()
    const preferredExists = preferred
      ? nextDevices.some((device) => device.deviceId === preferred.deviceId)
      : false
    setSelectedDeviceId(preferred && preferredExists
      ? preferred.deviceId
      : DEFAULT_MICROPHONE_DEVICE_ID)
  }, [])

  const startTest = useCallback(async (deviceId = selectedDeviceId) => {
    cleanupTest()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: buildMicrophoneConstraints(deviceId),
      })
      const track = stream.getAudioTracks()[0]
      if (!track) {
        throw new Error('当前设备没有返回可用麦克风。')
      }

      const audioContext = new AudioContext()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      const sourceNode = audioContext.createMediaStreamSource(stream)
      const analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 2048
      analyserNode.smoothingTimeConstant = 0.85
      sourceNode.connect(analyserNode)

      streamRef.current = stream
      audioContextRef.current = audioContext
      sourceNodeRef.current = sourceNode
      analyserRef.current = analyserNode
      setAnalyser(analyserNode)
      setActiveDeviceLabel(track.label || '当前麦克风')
      setPermissionState('ready')
      setMessage('设置页正在使用这支麦克风测试收音；训练页和沟通页会使用同一个选择。')
      setIsTesting(true)
      await refreshDevices()
    } catch (error) {
      reportFrontendDiagnostic('microphone-test', error)
      setPermissionState('error')
      setMessage(toProductMessage(error, 'microphone'))
      setActiveDeviceLabel('未连接')
      cleanupTest()
    }
  }, [cleanupTest, refreshDevices, selectedDeviceId])

  useEffect(() => {
    void refreshDevices()
    return () => {
      cleanupTest()
    }
  }, [cleanupTest, refreshDevices])

  const selectedDevice = devices.find((device) => device.deviceId === selectedDeviceId)
  const canSave = selectedDeviceId === DEFAULT_MICROPHONE_DEVICE_ID || Boolean(selectedDevice)

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fffdf8_0%,_#fff9f1_58%,_#f6f4ee_100%)]">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">音频设置</h1>
            <p className="mt-1 text-sm text-gray-600">
              只设置真正会影响沟通和训练录音的麦克风输入。
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-8">
        <section className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
                <Mic className="h-4 w-4" />
                麦克风输入
              </div>
              <h2 className="mt-3 text-xl font-semibold text-gray-900">选择实际收你声音的设备</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                保存后，沟通工作台和训练录音都会优先使用这支麦克风。换蓝牙耳机、USB 麦或远程虚拟声卡后，先来这里确认一次。
              </p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
              {permissionState === 'ready' ? '已授权' : permissionState === 'error' ? '需要处理' : '待测试'}
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="text-sm font-medium text-gray-900">首选麦克风</span>
              <select
                className="mt-2 h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                value={selectedDeviceId}
                onChange={(event) => {
                  setSelectedDeviceId(event.target.value)
                  cleanupTest()
                }}
              >
                <option value={DEFAULT_MICROPHONE_DEVICE_ID}>系统默认麦克风</option>
                {devices
                  .filter((device) => !device.isDefault)
                  .map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void startTest()}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                <Mic className="h-4 w-4" />
                {isTesting ? '重新测试' : '测试收音'}
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => {
                  const label = selectedDevice?.label ?? '系统默认麦克风'
                  savePreferredMicrophoneDevice({ deviceId: selectedDeviceId, label })
                  setMessage('已保存。下一次沟通和训练录音会优先使用这个输入设备。')
                }}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-amber-600 px-4 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                <Save className="h-4 w-4" />
                保存
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-stone-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">当前测试输入</p>
              <p className="mt-1 text-sm text-gray-600">{activeDeviceLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearPreferredMicrophoneDevice()
                setSelectedDeviceId(DEFAULT_MICROPHONE_DEVICE_ID)
                cleanupTest()
                setMessage('已恢复系统默认。')
              }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-100"
            >
              <RotateCcw className="h-4 w-4" />
              恢复默认
            </button>
          </div>

          <p className="mt-4 text-sm leading-6 text-gray-600">{message}</p>
        </section>

        <MicrophoneInputFeedback
          analyser={analyser}
          active={isTesting}
          title="现场收音检查"
          className="bg-white"
        />

        <section className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">这会影响哪里</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-sm font-medium text-gray-900">沟通工作台</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                沟通时会优先使用这里保存的麦克风。
              </p>
            </div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-sm font-medium text-gray-900">训练录音</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                录音样本会记录实际设备、收音电平、静音比例和质量分级，低质量样本只作为尝试回看。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
