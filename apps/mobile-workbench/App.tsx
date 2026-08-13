import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import * as Clipboard from 'expo-clipboard'
import * as Speech from 'expo-speech'

import { getMobileRuntimeConfig } from './src/api/mobile-config'
import { useMobileAuth } from './src/auth/use-mobile-auth'
import {
  displayMainlandPhone,
  normalizeMainlandPhone,
  shouldCreatePhoneUser,
} from './src/auth/mobile-phone'
import {
  MOBILE_WORKBENCH_SURFACES,
  type MobileWorkbenchSurfaceId,
} from './src/constants/surfaces'
import type { MobileWorkspaceReadModel } from './src/contracts/workspace-read-model'
import type { MobileWorkspaceSnapshotContract } from './src/contracts/workspace-read-model'
import type {
  MobileWorkbenchRecorderQueueItem,
  MobileWorkbenchScene,
} from './src/contracts/workbench-contracts'
import {
  type MobileDiagnosticSyncStatus,
  useMobileDiagnostics,
} from './src/diagnostics/use-mobile-diagnostics'
import { useNativeRecorderQueue } from './src/queue/use-native-recorder-queue'
import { useLiveKitRoomConnection } from './src/realtime/use-livekit-room-connection'
import { buildMobileWorkbenchRtcSessionIntent } from './src/realtime/rtc-session-intent'
import { useMobileRtcSession } from './src/realtime/use-mobile-rtc-session'
import { useMobileWorkspaceSnapshot } from './src/workspace/use-mobile-workspace'
import { toMobileProductMessage } from './src/ui/product-message'
import { useMobileTrainingCatalog } from './src/training/use-mobile-training-catalog'
import {
  analyzeMobileTrainingAttempt,
  summarizeMobileAssessment,
  type MobileAssessmentAttempt,
  type MobileTrainingFeedback,
} from './src/training/mobile-training-feedback'
import { buildMobilePreparedMaterialExercises } from './src/training/prepared-material-practice'
import { useMobileMemoryEditor } from './src/memory/use-mobile-memory-editor'
import type {
  MobileTrainingCategory,
  MobileTrainingExercise,
} from './src/training/training-catalog'

const LOCAL_PREPARED_LINES = [
  '请等我说完，我会用手机把重点给你看。',
  '我今天主要想确认检查结果和下一步安排。',
  '如果听不清，请让我慢一点重复。',
]

const LOCAL_QUICK_PHRASES = [
  '请看这句话',
  '我需要一点时间',
  '请不要替我回答',
  '我想重新说一遍',
]

const MOBILE_COMMUNICATION_SCENES: Array<{
  id: MobileWorkbenchScene
  label: string
  description: string
}> = [
  { id: 'interview', label: '求职 / 面试', description: '先守住表达权，再说结论和例子。' },
  { id: 'work', label: '工作协作', description: '先说判断、风险和下一步。' },
  { id: 'stranger', label: '陌生人开口', description: '先说明节奏，再说当前诉求。' },
  { id: 'medical', label: '就医沟通', description: '先说症状、位置和需要的帮助。' },
  { id: 'family', label: '家人 / 照护', description: '先说需求，保留自己回答的空间。' },
  { id: 'emergency', label: '紧急求助', description: '先把危险、位置和求助动作说清。' },
]

const COLORS = {
  background: '#F5F1EA',
  surface: '#FFFFFF',
  surfaceMuted: '#FAF8F4',
  ink: '#201B17',
  muted: '#71685F',
  subtle: '#A2988E',
  border: '#E5DDD3',
  accent: '#C65D2E',
  accentSoft: '#F6E7DD',
  success: '#287052',
  successSoft: '#E7F1EC',
  danger: '#A63D32',
  dangerSoft: '#F8E9E6',
} as const

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function friendlyError(message: string | null): string | null {
  if (!message) {
    return null
  }
  return toMobileProductMessage(message)
}

function connectionLabel(status: string): string {
  if (status === 'connected') return '正在沟通'
  if (status === 'connecting') return '正在连接'
  if (status === 'reconnecting') return '正在恢复连接'
  if (status === 'disconnecting') return '正在结束'
  if (status === 'error') return '连接遇到问题'
  return '可以开始'
}

function permissionLabel(status: string): string {
  if (status === 'granted') return '已允许'
  if (status === 'denied') return '未允许'
  if (status === 'undetermined') return '等待确认'
  return '尚未检查'
}

function syncLabel(status: MobileWorkbenchRecorderQueueItem['syncStatus']): string {
  if (status === 'uploaded' || status === 'indexed') return '已上传'
  if (status === 'upload_pending') return '等待上传'
  if (status === 'failed') return '上传失败'
  return '仅保存在本机'
}

function diagnosticLabel(
  status: MobileDiagnosticSyncStatus,
  pendingCount: number,
): string {
  if (status === 'sending') return '正在发送'
  if (status === 'error') return `待重试 ${pendingCount} 条`
  if (pendingCount > 0) return `待发送 ${pendingCount} 条`
  if (status === 'sent') return '已发送'
  return '自动收集已开启'
}

export default function App() {
  const config = useMemo(() => getMobileRuntimeConfig(), [])
  const auth = useMobileAuth(config)
  const diagnostics = useMobileDiagnostics({
    apiBaseUrl: config.apiBaseUrl,
    authenticated: auth.status === 'signed_in',
    tokenProvider: auth.tokenProvider,
  })
  const workspace = useMobileWorkspaceSnapshot({
    apiBaseUrl: config.apiBaseUrl,
    userId: auth.user?.id ?? null,
    tokenProvider: auth.tokenProvider,
    enabled: auth.status === 'signed_in',
  })
  const recorderQueue = useNativeRecorderQueue({
    apiBaseUrl: config.apiBaseUrl,
    contributorId: auth.user?.id ?? null,
    tokenProvider: auth.tokenProvider,
    surface: 'practice',
    mode: 'training',
  })
  const rtcSession = useMobileRtcSession({
    apiBaseUrl: config.apiBaseUrl,
    tokenProvider: auth.tokenProvider,
    enabled: auth.status === 'signed_in',
  })
  const liveKitRoom = useLiveKitRoomConnection()
  const trainingRtcSession = useMobileRtcSession({
    apiBaseUrl: config.apiBaseUrl,
    tokenProvider: auth.tokenProvider,
    enabled: auth.status === 'signed_in',
  })
  const trainingLiveKitRoom = useLiveKitRoomConnection()
  const trainingCatalog = useMobileTrainingCatalog({
    apiBaseUrl: config.apiBaseUrl,
    enabled: auth.status === 'signed_in',
    tokenProvider: auth.tokenProvider,
  })
  const memoryEditor = useMobileMemoryEditor({
    apiBaseUrl: config.apiBaseUrl,
    userId: auth.user?.id ?? null,
    tokenProvider: auth.tokenProvider,
    enabled: auth.status === 'signed_in',
  })
  const [activeSurfaceId, setActiveSurfaceId] =
    useState<MobileWorkbenchSurfaceId>('communication')
  const [practiceText, setPracticeText] = useState('')
  const [displayPhrase, setDisplayPhrase] = useState('')
  const [confirmedOutput, setConfirmedOutput] = useState('')
  const [communicationScene, setCommunicationScene] = useState<MobileWorkbenchScene | null>(null)

  const selectCommunicationScene = (scene: MobileWorkbenchScene | null): void => {
    if (scene && scene !== communicationScene) {
      rtcSession.clear()
    }
    setCommunicationScene(scene)
  }

  const rtcIntent = useMemo(
    () => buildMobileWorkbenchRtcSessionIntent({
      surfaceId: 'communication',
      scene: communicationScene ?? 'stranger',
      deviceContext: {
        microphoneStatus: 'unknown',
        networkOnline: true,
        appState: 'active',
      },
    }),
    [communicationScene],
  )
  const preparedLines = workspace.readModel.priorityLines.length > 0
    ? workspace.readModel.priorityLines
    : LOCAL_PREPARED_LINES
  const quickPhrases = workspace.readModel.quickPhrases.length > 0
    ? workspace.readModel.quickPhrases
    : LOCAL_QUICK_PHRASES

  useEffect(() => {
    if (liveKitRoom.latestAssistantTranscript) {
      setConfirmedOutput(liveKitRoom.latestAssistantTranscript)
    }
  }, [liveKitRoom.latestAssistantTranscript])

  useEffect(() => {
    if (liveKitRoom.status !== 'connected') {
      return undefined
    }

    const timer = setInterval(() => {
      void rtcSession.ping()
    }, 25_000)

    return () => clearInterval(timer)
  }, [liveKitRoom.status, rtcSession.ping])

  useEffect(() => {
    diagnostics.addBreadcrumb('navigation', 'open_surface', activeSurfaceId)
  }, [activeSurfaceId, diagnostics.addBreadcrumb])

  useEffect(() => {
    if (!workspace.errorMessage) {
      return
    }

    void diagnostics.capture({
      kind: 'api_failure',
      severity: 'error',
      code: 'workspace_snapshot_failed',
      surface: 'memory',
      phase: 'workspace_refresh',
      endpoint: '/memory/workspace/current',
    })
  }, [diagnostics.capture, workspace.errorMessage])

  useEffect(() => {
    if (!rtcSession.errorMessage) {
      return
    }

    void diagnostics.capture({
      kind: 'rtc_failure',
      severity: 'error',
      code: 'rtc_session_failed',
      surface: 'communication',
      phase: rtcSession.status,
      endpoint: '/rtc/session',
    })
  }, [diagnostics.capture, rtcSession.errorMessage, rtcSession.status])

  useEffect(() => {
    if (!liveKitRoom.errorMessage) {
      return
    }

    void diagnostics.capture({
      kind: 'rtc_failure',
      severity: 'error',
      code: 'livekit_connection_failed',
      surface: 'communication',
      phase: 'livekit_connect',
      connectionState: liveKitRoom.status,
    })
  }, [diagnostics.capture, liveKitRoom.errorMessage, liveKitRoom.status])

  useEffect(() => {
    if (!recorderQueue.errorMessage) {
      return
    }

    void diagnostics.capture({
      kind: 'recording_failure',
      severity: 'error',
      code: 'native_recorder_failed',
      surface: 'practice',
      phase: recorderQueue.isUploading ? 'upload' : 'recording',
    })
  }, [
    diagnostics.capture,
    recorderQueue.errorMessage,
    recorderQueue.isUploading,
  ])

  useEffect(() => {
    if (auth.status === 'signed_in') {
      return
    }

    if (
      liveKitRoom.status === 'connected'
      || liveKitRoom.status === 'connecting'
      || liveKitRoom.status === 'reconnecting'
    ) {
      void liveKitRoom.disconnect()
    }
    rtcSession.clear()
  }, [
    auth.status,
    liveKitRoom.disconnect,
    liveKitRoom.status,
    rtcSession.clear,
  ])

  const startCommunication = async (): Promise<void> => {
    if (rtcSession.session && rtcSession.status === 'ready') {
      await liveKitRoom.connect(rtcSession.session)
      return
    }

    const session = await rtcSession.start(rtcIntent)
    if (session) {
      await liveKitRoom.connect(session)
    }
  }

  const stopCommunication = async (): Promise<void> => {
    await liveKitRoom.disconnect()
    await rtcSession.stop()
  }

  const ensureTrainingConnection = async (): Promise<boolean> => {
    if (trainingLiveKitRoom.status === 'connected') return true
    const intent = buildMobileWorkbenchRtcSessionIntent({
      surfaceId: 'practice',
      mode: 'training',
      deviceContext: { microphoneStatus: 'available', networkOnline: true, appState: 'active' },
    })
    const session = trainingRtcSession.session ?? await trainingRtcSession.start(intent)
    return session ? await trainingLiveKitRoom.connect(session) : false
  }

  const stopTrainingSession = async (): Promise<void> => {
    await trainingLiveKitRoom.disconnect()
    await trainingRtcSession.stop()
  }

  const signOut = async (): Promise<void> => {
    if (rtcSession.session) {
      await stopCommunication()
    }
    if (trainingRtcSession.session) await stopTrainingSession()
    await auth.signOut()
  }

  const sendDiagnostics = async (): Promise<void> => {
    await diagnostics.capture({
      kind: 'manual',
      severity: 'info',
      code: 'manual_diagnostic_report',
      surface: activeSurfaceId,
      phase: 'account_action',
    })
    const sent = await diagnostics.sendNow()
    Alert.alert(
      sent ? '诊断已发送' : '诊断已保存在本机',
      sent
        ? '只包含版本、设备状态和脱敏错误信息，不包含录音、转写或聊天内容。'
        : '网络恢复并保持登录后，App 会自动重试发送。',
    )
  }

  const changeSurface = (surfaceId: MobileWorkbenchSurfaceId): void => {
    if (
      surfaceId !== 'communication'
      && (
        liveKitRoom.status === 'connected'
        || liveKitRoom.status === 'connecting'
        || liveKitRoom.status === 'reconnecting'
      )
    ) {
      void stopCommunication()
    }
    if (surfaceId !== 'practice' && trainingRtcSession.session) {
      void stopTrainingSession()
    }

    setActiveSurfaceId(surfaceId)
  }

  if (!auth.session) {
    return (
      <LoginScreen
        apiConfigured={Boolean(config.apiBaseUrl)}
        auth={auth}
        phoneAuthEnabled={config.phoneAuthEnabled}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.appShell}>
        <AppHeader
          email={auth.user?.email ?? auth.user?.phone ?? 'VoxFlame 用户'}
          status={workspace.status === 'ready' ? '资料已同步' : '正在准备'}
        />

        <ScrollView
          contentContainerStyle={styles.pageContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.content}
        >
          {activeSurfaceId === 'communication' ? (
            <CommunicationScreen
              connectionStatus={liveKitRoom.status}
              displayPhrase={displayPhrase}
              confirmedOutput={confirmedOutput}
              errorMessage={friendlyError(
                liveKitRoom.errorMessage ?? rtcSession.errorMessage,
              )}
              onPhrasePress={setDisplayPhrase}
              onConfirmedOutputChange={setConfirmedOutput}
              onSendText={(text) => liveKitRoom.sendText(text)}
              onStart={() => void startCommunication()}
              onStop={() => void stopCommunication()}
              preparedLines={preparedLines}
              quickPhrases={quickPhrases}
              currentUserTranscript={liveKitRoom.currentUserTranscript}
              latestUserTranscript={liveKitRoom.latestUserTranscript}
              scene={communicationScene}
              scenes={MOBILE_COMMUNICATION_SCENES}
              onSceneChange={selectCommunicationScene}
              starting={rtcSession.status === 'starting'}
            />
          ) : null}

          {activeSurfaceId === 'practice' ? (
            <PracticeScreen
              dailyTarget={workspace.readModel.dailyTargetCount}
              onPracticeTextChange={setPracticeText}
              practiceText={practiceText}
              preparedExpression={workspace.snapshot?.prepared_expression ?? null}
              preparedLines={preparedLines}
              queue={recorderQueue}
              catalog={trainingCatalog}
              ensureTrainingConnection={ensureTrainingConnection}
              trainingConnection={trainingLiveKitRoom}
            />
          ) : null}

          {activeSurfaceId === 'memory' ? (
            <MemoryScreen
              errorMessage={friendlyError(workspace.errorMessage)}
              loading={workspace.status === 'loading'}
              onRefresh={workspace.refresh}
              readModel={workspace.readModel}
              snapshot={workspace.snapshot}
              editor={memoryEditor}
            />
          ) : null}

          {activeSurfaceId === 'device' ? (
            <AccountScreen
              apiConfigured={Boolean(config.apiBaseUrl)}
              auth={auth}
              diagnosticStatus={diagnostics.status}
              onRequestPermission={() => void recorderQueue.requestPermission()}
              onSendDiagnostics={() => void sendDiagnostics()}
              onSignOut={() => void signOut()}
              onSync={workspace.refresh}
              pendingDiagnosticCount={diagnostics.pendingCount}
              permissionStatus={recorderQueue.permissionStatus}
              phoneAuthEnabled={config.phoneAuthEnabled}
              queueCount={recorderQueue.items.filter(
                (item) => item.syncStatus !== 'uploaded' && item.syncStatus !== 'indexed',
              ).length}
              workspaceReady={workspace.status === 'ready'}
            />
          ) : null}
        </ScrollView>

        <BottomNavigation
          activeSurfaceId={activeSurfaceId}
          onChange={changeSurface}
        />
      </View>
    </SafeAreaView>
  )
}

function LoginScreen({
  apiConfigured,
  auth,
  phoneAuthEnabled,
}: {
  apiConfigured: boolean
  auth: ReturnType<typeof useMobileAuth>
  phoneAuthEnabled: boolean
}) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState(auth.lastEmail)
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [localError, setLocalError] = useState<string | null>(null)
  const isBusy = (
    auth.status === 'initializing'
    || auth.status === 'signing_in'
    || auth.status === 'sending_code'
    || auth.status === 'verifying_code'
  )

  useEffect(() => {
    if (!email && auth.lastEmail) {
      setEmail(auth.lastEmail)
    }
  }, [auth.lastEmail, email])

  useEffect(() => {
    if (resendSeconds <= 0) {
      return undefined
    }
    const timer = setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendSeconds])

  const requestPhoneCode = async (): Promise<void> => {
    let normalizedPhone: string
    try {
      normalizedPhone = normalizeMainlandPhone(phone)
    } catch {
      setLocalError('手机号格式不正确。')
      return
    }

    setLocalError(null)
    const requested = await auth.requestPhoneLoginCode(
      normalizedPhone,
      shouldCreatePhoneUser(authMode),
    )
    if (requested) {
      setPhoneCodeSent(true)
      setResendSeconds(60)
    }
  }

  const verifyPhoneCode = async (): Promise<void> => {
    let normalizedPhone: string
    try {
      normalizedPhone = normalizeMainlandPhone(phone)
    } catch {
      setLocalError('手机号格式不正确。')
      return
    }
    if (!/^\d{6}$/.test(otp)) {
      setLocalError('请输入短信中的 6 位验证码。')
      return
    }

    setLocalError(null)
    await auth.verifyPhoneLoginCode({ phone: normalizedPhone, otp })
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={styles.loginPage}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>V</Text>
        </View>
        <Text style={styles.loginTitle}>把想说的话，稳稳传达。</Text>
        <Text style={styles.loginCopy}>
          沟通、练习和准备材料，都在这里。
        </Text>

        <View style={styles.loginCard}>
          {phoneAuthEnabled && authMode === 'login' ? (
            <View accessibilityRole="tablist" style={styles.loginMethodRow}>
              {(['email', 'phone'] as const).map((method) => {
                const active = loginMethod === method
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    key={method}
                    onPress={() => {
                      setLoginMethod(method)
                      setPhoneCodeSent(false)
                      setOtp('')
                      setLocalError(null)
                    }}
                    style={[styles.loginMethodTab, active ? styles.loginMethodTabActive : null]}
                  >
                    <Text style={[styles.loginMethodText, active ? styles.loginMethodTextActive : null]}>
                      {method === 'email' ? '邮箱登录' : '手机登录'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          {authMode === 'login' && loginMethod === 'email' ? (
            <>
              <Text style={styles.fieldLabel}>邮箱</Text>
              <TextInput
                accessibilityLabel="邮箱"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isBusy}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={COLORS.subtle}
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
              <Text style={styles.fieldLabel}>密码</Text>
              <TextInput
                accessibilityLabel="密码"
                editable={!isBusy}
                onChangeText={setPassword}
                placeholder="输入密码"
                placeholderTextColor={COLORS.subtle}
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={password}
              />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>中国大陆手机号</Text>
              <TextInput
                accessibilityLabel="中国大陆手机号"
                editable={!isBusy && !phoneCodeSent}
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="138 1234 5678"
                placeholderTextColor={COLORS.subtle}
                style={styles.input}
                textContentType="telephoneNumber"
                value={phone}
              />
              {phoneCodeSent ? (
                <>
                  <Text style={styles.fieldLabel}>6 位验证码</Text>
                  <TextInput
                    accessibilityLabel="6 位验证码"
                    editable={!isBusy}
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="短信验证码"
                    placeholderTextColor={COLORS.subtle}
                    style={[styles.input, styles.otpInput]}
                    textContentType="oneTimeCode"
                    value={otp}
                  />
                  <View style={styles.phoneCodeActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isBusy || resendSeconds > 0}
                      onPress={() => void requestPhoneCode()}
                      style={styles.textAction}
                    >
                      <Text style={styles.textActionText}>
                        {resendSeconds > 0 ? `${resendSeconds} 秒后重发` : '重新发送'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isBusy}
                      onPress={() => {
                        setPhoneCodeSent(false)
                        setOtp('')
                      }}
                      style={styles.textAction}
                    >
                      <Text style={styles.textActionText}>修改手机号</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={styles.loginHint}>
                  {authMode === 'login'
                    ? '使用已经注册的手机号登录；未注册号码不会自动创建账号。'
                    : '验证手机号后将创建新的 VoxFlame 账号。'}
                </Text>
              )}
            </>
          )}
          {localError || friendlyError(auth.errorMessage) ? (
            <InlineMessage tone="danger" text={localError ?? friendlyError(auth.errorMessage) ?? ''} />
          ) : null}
          {!apiConfigured || auth.status === 'config_missing' ? (
            <InlineMessage tone="danger" text="服务暂不可用，请稍后再试。" />
          ) : null}
          <PrimaryButton
            disabled={isBusy || !apiConfigured || auth.status === 'config_missing'}
            label={isBusy
              ? phoneAuthEnabled && loginMethod === 'phone' ? '正在处理…' : '正在登录…'
              : loginMethod === 'phone'
                ? phoneCodeSent
                  ? authMode === 'register' ? '验证并注册' : '验证并登录'
                  : '发送验证码'
                : '邮箱登录'}
            onPress={() => {
              if (loginMethod === 'email') {
                void auth.signInWithPassword({ email, password })
                return
              }
              void (phoneCodeSent ? verifyPhoneCode() : requestPhoneCode())
            }}
          />
          {phoneAuthEnabled ? (
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              onPress={() => {
                const nextMode = authMode === 'login' ? 'register' : 'login'
                setAuthMode(nextMode)
                setLoginMethod(nextMode === 'register' ? 'phone' : 'email')
                setPhoneCodeSent(false)
                setOtp('')
                setLocalError(null)
              }}
              style={styles.textAction}
            >
              <Text style={styles.textActionText}>
                {authMode === 'login' ? '使用手机号注册' : '返回账号登录'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.privacyCopy}>
          你的沟通资料仅用于已登录账户的同步。
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function AppHeader({ email, status }: { email: string; status: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.wordmark}>VoxFlame</Text>
        <Text numberOfLines={1} style={styles.headerEmail}>{email}</Text>
      </View>
      <View style={styles.statusBadge}>
        <View style={styles.statusDot} />
        <Text style={styles.statusBadgeText}>{status}</Text>
      </View>
    </View>
  )
}

function CommunicationScreen({
  confirmedOutput,
  connectionStatus,
  currentUserTranscript,
  displayPhrase,
  errorMessage,
  latestUserTranscript,
  onConfirmedOutputChange,
  onPhrasePress,
  onSceneChange,
  onSendText,
  onStart,
  onStop,
  preparedLines,
  quickPhrases,
  scene,
  scenes,
  starting,
}: {
  confirmedOutput: string
  connectionStatus: string
  currentUserTranscript: string
  displayPhrase: string
  errorMessage: string | null
  latestUserTranscript: string
  onConfirmedOutputChange(value: string): void
  onPhrasePress(phrase: string): void
  onSceneChange(scene: MobileWorkbenchScene | null): void
  onSendText(text: string): Promise<boolean>
  onStart(): void
  onStop(): void
  preparedLines: string[]
  quickPhrases: string[]
  scene: MobileWorkbenchScene | null
  scenes: Array<{ id: MobileWorkbenchScene; label: string; description: string }>
  starting: boolean
}) {
  const [showPartnerView, setShowPartnerView] = useState(false)
  const [outputStatus, setOutputStatus] = useState<string | null>(null)
  const connected = connectionStatus === 'connected' || connectionStatus === 'reconnecting'
  const busy = connectionStatus === 'connecting' || connectionStatus === 'disconnecting' || starting
  const leadPhrase = displayPhrase || preparedLines[0]
  const liveTranscript = currentUserTranscript || latestUserTranscript

  const usePhrase = async (phrase: string): Promise<void> => {
    onPhrasePress(phrase)
    onConfirmedOutputChange(phrase)
    if (connected) {
      await onSendText(phrase)
    }
  }

  const speakConfirmedOutput = (): void => {
    const text = confirmedOutput.trim()
    if (!text) {
      setOutputStatus('先写好要朗读的一句话。')
      return
    }
    Speech.stop()
    Speech.speak(text, {
      language: 'zh-CN',
      rate: 0.9,
      onDone: () => setOutputStatus('朗读完成。'),
      onError: () => setOutputStatus('朗读没有完成，请重试。'),
    })
    setOutputStatus('正在朗读。')
  }

  const copyConfirmedOutput = async (): Promise<void> => {
    const text = confirmedOutput.trim()
    if (!text) {
      setOutputStatus('先写好要复制的一句话。')
      return
    }
    await Clipboard.setStringAsync(text)
    setOutputStatus('已复制，可以粘贴到其他应用。')
  }

  return (
    <View style={styles.screen}>
      <View style={styles.heroHeading}>
        <Text style={styles.eyebrow}>现在沟通</Text>
        <Text style={styles.pageTitle}>先把关键一句说清楚</Text>
        <Text style={styles.pageCopy}>你随时可以停下、重说，或直接把文字给对方看。</Text>
      </View>

      {!scene ? (
        <View style={styles.taskCard}>
          <Text style={styles.taskCardEyebrow}>先选当前场景</Text>
          <Text style={styles.taskCardTitle}>让助手先知道这次最重要什么</Text>
          <View style={styles.categoryList}>
            {scenes.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => onSceneChange(item.id)}
                style={({ pressed }) => [styles.categoryRow, pressed ? styles.pressed : null]}
              >
                <View style={styles.categoryCopy}>
                  <Text style={styles.categoryTitle}>{item.label}</Text>
                  <Text style={styles.mutedText}>{item.description}</Text>
                </View>
                <Text style={styles.phraseArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {scene ? <><View style={styles.sceneBar}>
        <View style={styles.sceneBarCopy}>
          <Text style={styles.cardLabel}>当前场景</Text>
          <Text style={styles.categoryTitle}>{scenes.find((item) => item.id === scene)?.label}</Text>
        </View>
        {!connected ? (
          <SecondaryButton compact label="更换" onPress={() => onSceneChange(null)} />
        ) : null}
      </View>
      <View style={styles.communicationCard}>
        <View style={styles.connectionRow}>
          <View style={[styles.liveDot, connected ? styles.liveDotActive : null]} />
          <Text style={styles.connectionText}>{connectionLabel(connectionStatus)}</Text>
        </View>
        <Text style={styles.displayPhrase}>{leadPhrase}</Text>
        <PrimaryButton
          disabled={busy}
          label={connected ? '结束沟通' : busy ? '正在连接…' : '开始沟通'}
          onPress={connected ? onStop : onStart}
          tone={connected ? 'neutral' : 'accent'}
        />
        {errorMessage ? <InlineMessage tone="danger" text={errorMessage} /> : null}
      </View></> : null}

      {scene && (connected || liveTranscript || confirmedOutput) ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>实时理解</Text>
          <Text style={styles.liveTranscript}>
            {liveTranscript || '开始说话后，系统听到的内容会出现在这里。'}
          </Text>
          <Text style={styles.fieldLabel}>给对方看的这一句</Text>
          <TextInput
            accessibilityLabel="确认输出"
            multiline
            onChangeText={onConfirmedOutputChange}
            placeholder="助手整理后的文本会出现在这里，也可以直接输入。"
            placeholderTextColor={COLORS.subtle}
            style={styles.practiceInput}
            value={confirmedOutput}
          />
          <View style={styles.outputActions}>
            <SecondaryButton label="给对方看" onPress={() => setShowPartnerView(true)} />
            <SecondaryButton label="文本发声" onPress={speakConfirmedOutput} />
            <SecondaryButton label="复制" onPress={() => void copyConfirmedOutput()} />
          </View>
          {outputStatus ? <Text style={styles.outputStatus}>{outputStatus}</Text> : null}
        </View>
      ) : null}

      {scene ? <><SectionHeader title="常用短句" />
      <View style={styles.phraseList}>
        {quickPhrases.slice(0, 6).map((phrase) => (
          <Pressable
            accessibilityHint="将这句话放大显示"
            accessibilityRole="button"
            key={phrase}
            onPress={() => void usePhrase(phrase)}
            style={({ pressed }) => [
              styles.phraseButton,
              displayPhrase === phrase ? styles.phraseButtonActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.phraseButtonText}>{phrase}</Text>
            <Text style={styles.phraseArrow}>›</Text>
          </Pressable>
        ))}
      </View></> : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setShowPartnerView(false)}
        transparent={false}
        visible={showPartnerView}
      >
        <SafeAreaView style={styles.partnerView}>
          <Text style={styles.partnerLabel}>请看这句话</Text>
          <Text selectable style={styles.partnerText}>
            {confirmedOutput.trim() || '请给我一点时间。'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPartnerView(false)}
            style={styles.partnerCloseButton}
          >
            <Text style={styles.partnerCloseText}>返回沟通</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

function PracticeScreen({
  catalog,
  dailyTarget,
  ensureTrainingConnection,
  onPracticeTextChange,
  practiceText,
  preparedExpression,
  preparedLines,
  queue,
  trainingConnection,
}: {
  catalog: ReturnType<typeof useMobileTrainingCatalog>
  dailyTarget: number
  ensureTrainingConnection(): Promise<boolean>
  onPracticeTextChange(value: string): void
  practiceText: string
  preparedExpression: MobileWorkspaceSnapshotContract['prepared_expression']
  preparedLines: string[]
  queue: ReturnType<typeof useNativeRecorderQueue>
  trainingConnection: ReturnType<typeof useLiveKitRoomConnection>
}) {
  const [flow, setFlow] = useState<'home' | 'assessment' | 'collection' | 'material'>('home')
  const [selectedExercise, setSelectedExercise] = useState<MobileTrainingExercise | null>(null)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [activeCaptureId, setActiveCaptureId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<MobileTrainingFeedback | null>(null)
  const [assessmentAttempts, setAssessmentAttempts] = useState<MobileAssessmentAttempt[]>([])
  const [showRecordings, setShowRecordings] = useState(false)
  const materialExercises = useMemo(
    () => buildMobilePreparedMaterialExercises(preparedExpression),
    [preparedExpression],
  )
  const visibleExercises = flow === 'material' ? materialExercises : catalog.exercises
  const visibleTotal = flow === 'material' ? materialExercises.length : catalog.total
  const selectedCategory = catalog.categories.find(
    (category) => category.id === catalog.selectedCategory,
  )
  const targetText = practiceText.trim() || selectedExercise?.text || preparedLines[0] || '输入想练习的一句话'
  const assessmentSummary = summarizeMobileAssessment(
    assessmentAttempts,
    flow === 'assessment' ? visibleTotal : 20,
  )

  useEffect(() => {
    setSelectedExercise(visibleExercises[0] ?? null)
    setExerciseIndex(0)
  }, [flow, visibleExercises])

  useEffect(() => {
    if (!practiceText.trim()) setFeedback(null)
  }, [practiceText])

  const openAssessment = (): void => {
    const assessment = catalog.categories.find((category) => category.kind === 'assessment')
    if (assessment) {
      setFlow('assessment')
      void catalog.selectCategory(assessment.id)
    }
  }

  const selectCollectionCategory = (category: MobileTrainingCategory): void => {
    setFlow('collection')
    setFeedback(null)
    void catalog.selectCategory(category.id)
  }

  const confirmDiscard = (item: MobileWorkbenchRecorderQueueItem): void => {
    Alert.alert(
      '删除这条录音？',
      item.syncStatus === 'uploaded' || item.syncStatus === 'indexed'
        ? '将同时撤回云端训练资产并删除本机录音。这个操作无法恢复。'
        : '将删除本机录音。这个操作无法恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: item.syncStatus === 'uploaded' || item.syncStatus === 'indexed' ? '撤回并删除' : '删除录音',
          style: 'destructive',
          onPress: () => void queue.discard(item.recordingId),
        },
      ],
    )
  }

  const startTrainingAttempt = async (): Promise<void> => {
    setFeedback(null)
    const connected = await ensureTrainingConnection()
    if (!connected) return
    const captureId = `mobile-training-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const announced = await trainingConnection.startTrainingCapture(captureId, flow === 'assessment')
    if (!announced) return
    setActiveCaptureId(captureId)
    await queue.startRecording(targetText, {
      sentenceId: selectedExercise?.id,
      source: flow === 'assessment' ? 'mobile_assessment' : flow === 'material' ? 'mobile_prepared_material' : 'mobile_training_catalog',
      metadata: {
        exercise_category: selectedExercise?.category,
        training_flow: flow,
        client_capture_id: captureId,
      },
    })
  }

  const stopAndAnalyze = async (): Promise<void> => {
    const captureId = activeCaptureId
    if (!captureId) return
    setActiveCaptureId(null)
    const [item] = await Promise.all([
      queue.stopRecording(),
      trainingConnection.stopTrainingCapture(captureId),
    ])
    if (!item) return
    const heardText = await trainingConnection.waitForFinalTranscript(captureId)
    const exercise = selectedExercise ?? { id: item.recordingId, text: targetText, category: '自定义练习' }
    const nextFeedback = analyzeMobileTrainingAttempt(exercise, heardText)
    setFeedback(nextFeedback)
    const enrichedItem = await queue.attachRecognition(item.recordingId, heardText, {
      kind: 'training_result',
      exercise_id: exercise.id,
      exercise_text: exercise.text,
      target_text: exercise.text,
      raw_transcript: heardText,
      recognized_text: heardText,
      feedback_status: nextFeedback.status,
      clarity_score: nextFeedback.status === 'excellent'
        ? 0.95
        : nextFeedback.status === 'close' ? 0.78 : nextFeedback.status === 'retry' ? 0.48 : 0.2,
      missing_chars: nextFeedback.missingChars,
      extra_chars: nextFeedback.extraChars,
      ...(flow === 'material' && preparedExpression
        ? { prepared_expression_id: preparedExpression.id }
        : {}),
    })
    if (enrichedItem) await queue.uploadRecording(enrichedItem.recordingId, enrichedItem)
    if (flow === 'assessment' && selectedExercise) {
      setAssessmentAttempts((current) => {
        const attempt = {
          exerciseId: selectedExercise.id,
          targetText: selectedExercise.text,
          heardText,
          normalizedTarget: nextFeedback.normalizedTarget,
          missingChars: nextFeedback.missingChars,
        }
        return [...current.filter((entry) => entry.exerciseId !== selectedExercise.id), attempt]
      })
    }
  }

  const selectExerciseAt = (index: number): void => {
    const bounded = Math.max(0, Math.min(visibleExercises.length - 1, index))
    setExerciseIndex(bounded)
    setSelectedExercise(visibleExercises[bounded] ?? null)
    onPracticeTextChange('')
    setFeedback(null)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.heroHeading}>
        <Text style={styles.eyebrow}>练习</Text>
        <Text style={styles.pageTitle}>
          {flow === 'assessment' ? '20 词能力筛查' : flow === 'collection' ? '训练与收集' : '先选这次要做什么'}
        </Text>
        <Text style={styles.pageCopy}>
          {flow === 'assessment'
            ? '按顺序完成整组，只做训练分层，不替代医学评估。'
            : flow === 'collection'
              ? `今天建议 ${dailyTarget} 句。每次只专注当前这一句。`
              : '筛查和训练是两件事，分开完成会更清楚。'}
        </Text>
      </View>

      {flow === 'home' ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={openAssessment}
            style={({ pressed }) => [styles.taskCard, pressed ? styles.pressed : null]}
          >
            <Text style={styles.taskCardEyebrow}>第一次或想重新了解自己</Text>
            <Text style={styles.taskCardTitle}>开始 20 词能力筛查</Text>
            <Text style={styles.taskCardCopy}>固定 20 词，完成整组后才显示训练分层。</Text>
          </Pressable>
          <View style={styles.taskCard}>
            <Text style={styles.taskCardEyebrow}>今天继续练</Text>
            <Text style={styles.taskCardTitle}>选择训练与收集主题</Text>
            <Text style={styles.taskCardCopy}>使用与网页版同一份主题目录和训练题库。</Text>
            <View style={styles.categoryList}>
              {catalog.categories.filter((category) => category.kind === 'collection').map((category) => (
                <Pressable
                  accessibilityRole="button"
                  key={category.id}
                  onPress={() => selectCollectionCategory(category)}
                  style={({ pressed }) => [styles.categoryRow, pressed ? styles.pressed : null]}
                >
                  <View style={styles.categoryCopy}>
                    <Text style={styles.categoryTitle}>{category.label}</Text>
                    <Text numberOfLines={2} style={styles.mutedText}>{category.description}</Text>
                  </View>
                  <Text style={styles.categoryCount}>{category.count} 句</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {preparedLines.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFlow('material')
                setFeedback(null)
              }}
              style={({ pressed }) => [styles.taskCard, pressed ? styles.pressed : null]}
            >
              <Text style={styles.taskCardEyebrow}>为下一次沟通准备</Text>
              <Text style={styles.taskCardTitle}>练习我的材料</Text>
              <Text style={styles.taskCardCopy}>使用沟通档案中的材料，不混入公共题库。</Text>
            </Pressable>
          ) : null}
          {preparedExpression?.training_reports ? (
            <View style={styles.trainingReportPreview}>
              <View style={styles.sectionIntro}>
                <Text style={styles.sectionTitle}>训练回顾</Text>
                <Text style={styles.mutedText}>只看下一步，不做压力报表。</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.cardLabel}>今天</Text>
                <Text style={styles.reportText}>{preparedExpression.training_reports.daily_summary?.summary ?? '今天继续练几句后会自动更新。'}</Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={styles.cardLabel}>最近 7 天</Text>
                <Text style={styles.reportText}>{preparedExpression.training_reports.weekly_summary?.summary ?? '积累更多真实训练后再看稳定规律。'}</Text>
              </View>
              {preparedExpression.training_reports.training_plan?.items.length ? (
                <Text style={styles.mutedText}>下一步：{preparedExpression.training_reports.training_plan.items[0]}</Text>
              ) : null}
            </View>
          ) : null}
          {catalog.status === 'loading' ? <ActivityIndicator color={COLORS.accent} /> : null}
          {catalog.errorMessage ? <InlineMessage tone="danger" text={catalog.errorMessage} /> : null}
        </>
      ) : (
        <>
          <Pressable accessibilityRole="button" onPress={() => setFlow('home')} style={styles.textAction}>
            <Text style={styles.textActionText}>← 返回练习选择</Text>
          </Pressable>

          <View style={styles.trainingStage}>
            <View style={styles.trainingProgressRow}>
              <Text style={styles.cardLabel}>{flow === 'material' ? '我的材料' : selectedCategory?.label ?? '训练题库'}</Text>
              <Text style={styles.trainingProgressText}>{exerciseIndex + 1} / {visibleTotal || 1}</Text>
            </View>
            <Text style={styles.trainingTarget}>{targetText}</Text>
            <View style={styles.recordingMeta}>
              <Text style={styles.recordingMetaText}>
                {queue.isRecording ? '正在听你说' : feedback ? '本次反馈' : `麦克风${permissionLabel(queue.permissionStatus)}`}
              </Text>
              <Text style={styles.timer}>{formatDuration(queue.durationMs)}</Text>
            </View>
            <PrimaryButton
              label={queue.isRecording ? '说完了' : flow === 'assessment' ? '开始说这个词' : '开始说这句话'}
              onPress={() => {
                if (queue.isRecording) {
                  void stopAndAnalyze()
                } else {
                  void startTrainingAttempt()
                }
              }}
              tone={queue.isRecording ? 'neutral' : 'accent'}
            />
            {friendlyError(queue.errorMessage) ? (
              <InlineMessage tone="danger" text={friendlyError(queue.errorMessage) ?? ''} />
            ) : null}
            {feedback ? (
              <View style={styles.feedbackPanel}>
                <Text style={styles.feedbackLabel}>系统听到</Text>
                <Text style={styles.feedbackHeard}>{feedback.normalizedHeard || '暂时没有听清'}</Text>
                <Text style={styles.feedbackSummary}>{feedback.summary}</Text>
                <Text style={styles.mutedText}>{feedback.suggestion}</Text>
              </View>
            ) : null}
            {flow === 'assessment' ? (
              <View style={styles.assessmentProgress}>
                <Text style={styles.categoryTitle}>{assessmentSummary.label}</Text>
                <Text style={styles.mutedText}>{assessmentSummary.summary}</Text>
              </View>
            ) : null}
            <View style={styles.stepActions}>
              <SecondaryButton disabled={exerciseIndex === 0 || queue.isRecording} label="上一句" onPress={() => selectExerciseAt(exerciseIndex - 1)} />
              <SecondaryButton disabled={exerciseIndex >= visibleExercises.length - 1 || queue.isRecording} label="下一句" onPress={() => selectExerciseAt(exerciseIndex + 1)} />
            </View>
          </View>

          {flow !== 'material' && catalog.exercises.length < catalog.total ? (
            <SecondaryButton
              disabled={catalog.status === 'loading'}
              label={catalog.status === 'loading' ? '正在加载…' : '加载更多句子'}
              onPress={() => void catalog.loadMore()}
            />
          ) : null}
        </>
      )}

      {flow === 'home' ? null : <View style={styles.customPracticePanel}>
        <Text style={styles.fieldLabel}>改成自己的句子</Text>
        <TextInput
          accessibilityLabel="练习句"
          editable={!queue.isRecording}
          multiline
          onChangeText={onPracticeTextChange}
          placeholder={preparedLines[0] ?? '输入想练习的一句话'}
          placeholderTextColor={COLORS.subtle}
          style={styles.practiceInput}
          value={practiceText}
        />
        <Text style={styles.mutedText}>输入后会替换上方目标句；录音仍会自动保存，失败时留在本机。</Text>
      </View>}

      {flow === 'home' ? null : <><Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showRecordings }}
        onPress={() => setShowRecordings((value) => !value)}
        style={styles.recordingDisclosure}
      >
        <Text style={styles.sectionTitle}>录音记录</Text>
        <Text style={styles.sectionAside}>{queue.items.length} 条 · {showRecordings ? '收起' : '查看'}</Text>
      </Pressable>
      {showRecordings ? <><SectionHeader
        aside={`${queue.items.length} 条`}
        title="本机录音"
      />
      {queue.items.length === 0 ? (
        <EmptyState text="完成第一条录音后，可以在这里回放或上传。" />
      ) : (
        <View style={styles.recordingList}>
          {queue.items.map((item) => (
            <View key={item.recordingId} style={styles.recordingItem}>
              <Text numberOfLines={2} style={styles.recordingText}>{item.text}</Text>
              <View style={styles.recordingItemMeta}>
                <Text style={styles.mutedText}>{syncLabel(item.syncStatus)}</Text>
                <Text style={styles.mutedText}>
                  {formatDuration(item.recording.audio.durationMs)}
                </Text>
              </View>
              {item.lastError ? (
                <InlineMessage tone="danger" text="上次上传没有完成，可以稍后重试。" />
              ) : null}
              <View style={styles.actionRow}>
                <SecondaryButton
                  label="回放"
                  onPress={() => queue.playRecording(item.recordingId)}
                />
                <SecondaryButton
                  disabled={
                    item.syncStatus === 'uploaded'
                    || item.syncStatus === 'indexed'
                    || queue.uploadingRecordingId === item.recordingId
                  }
                  label={
                    queue.uploadingRecordingId === item.recordingId
                      ? '上传中…'
                      : item.syncStatus === 'uploaded' || item.syncStatus === 'indexed'
                        ? '已上传'
                        : '上传'
                  }
                  onPress={() => void queue.uploadRecording(item.recordingId)}
                />
                <SecondaryButton
                  destructive
                  disabled={queue.uploadingRecordingId === item.recordingId}
                  label="删除"
                  onPress={() => confirmDiscard(item)}
                />
              </View>
            </View>
          ))}
        </View>
      )}</> : null}</>}
    </View>
  )
}

function MemoryScreen({
  editor,
  errorMessage,
  loading,
  onRefresh,
  readModel,
  snapshot,
}: {
  editor: ReturnType<typeof useMobileMemoryEditor>
  errorMessage: string | null
  loading: boolean
  onRefresh(): void
  readModel: MobileWorkspaceReadModel
  snapshot: MobileWorkspaceSnapshotContract | null
}) {
  const [section, setSection] = useState<'overview' | 'materials' | 'profile' | 'phrases'>('overview')
  const [materialId, setMaterialId] = useState<string | undefined>()
  const [materialTitle, setMaterialTitle] = useState('')
  const [materialContent, setMaterialContent] = useState('')
  const [profileDocument, setProfileDocument] = useState('')
  const [profileScenarios, setProfileScenarios] = useState('')
  const [profileStrategies, setProfileStrategies] = useState('')
  const [phraseId, setPhraseId] = useState<string | undefined>()
  const [phraseText, setPhraseText] = useState('')
  const busy = loading || editor.status === 'loading' || editor.status === 'saving'

  useEffect(() => {
    const profile = snapshot?.user_profile_memory
    setProfileDocument(profile?.document ?? '')
    setProfileScenarios((profile?.common_scenarios ?? []).join('\n'))
    setProfileStrategies((profile?.support_strategies ?? []).join('\n'))
  }, [snapshot?.user_profile_memory])

  const editMaterial = (id?: string): void => {
    const asset = editor.library?.assets.find((item) => item.draft.id === id)
    setMaterialId(asset?.draft.id)
    setMaterialTitle(asset?.draft.title ?? '')
    setMaterialContent(asset?.draft.content ?? '')
  }

  const saveMaterial = async (): Promise<void> => {
    if (!materialTitle.trim() || !materialContent.trim()) return
    const saved = await editor.saveMaterial({
      id: materialId,
      title: materialTitle.trim(),
      content: materialContent.trim(),
      make_active: !materialId,
    })
    if (saved) {
      editMaterial(undefined)
      onRefresh()
    }
  }

  const splitLines = (value: string): string[] => value
    .split(/\n|，|；/)
    .map((item) => item.trim())
    .filter(Boolean)

  return (
    <View style={styles.screen}>
      <View style={styles.heroHeading}>
        <Text style={styles.eyebrow}>沟通准备</Text>
        <Text style={styles.pageTitle}>把要说的话放在手边</Text>
        <Text style={styles.pageCopy}>这里与网页版使用同一份沟通档案。</Text>
      </View>

      <View accessibilityRole="tablist" style={styles.segmentedTabs}>
        {([
          ['overview', '概览'],
          ['materials', '材料'],
          ['profile', '画像'],
          ['phrases', '短句'],
        ] as const).map(([id, label]) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: section === id }}
            key={id}
            onPress={() => setSection(id)}
            style={[styles.segmentedTab, section === id ? styles.segmentedTabActive : null]}
          >
            <Text style={[styles.segmentedTabText, section === id ? styles.segmentedTabTextActive : null]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {section === 'overview' ? <><View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderCopy}>
            <Text style={styles.cardLabel}>下一次重点</Text>
            <Text style={styles.cardTitle}>
              {readModel.immediateGoal || '先准备一句最重要的话'}
            </Text>
          </View>
          <SecondaryButton
            compact
            disabled={loading}
            label={loading ? '同步中' : '同步'}
            onPress={onRefresh}
          />
        </View>
        {errorMessage ? <InlineMessage tone="danger" text={errorMessage} /> : null}
      </View>

      <SectionHeader title={readModel.preparedTitle || '准备好的表达'} />
      {readModel.preparedSummary ? (
        <Text style={styles.sectionSummary}>{readModel.preparedSummary}</Text>
      ) : null}
      {readModel.priorityLines.length === 0 ? (
        <EmptyState text={readModel.localEmptyState} />
      ) : (
        <View style={styles.preparedList}>
          {readModel.priorityLines.map((line, index) => (
            <View key={`${line}-${index}`} style={styles.preparedItem}>
              <Text style={styles.preparedIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.preparedText}>{line}</Text>
            </View>
          ))}
        </View>
      )}

      <SectionHeader title="随时可用" />
      <View style={styles.chipWrap}>
        {readModel.quickPhrases.map((phrase) => (
          <View key={phrase} style={styles.chip}>
            <Text style={styles.chipText}>{phrase}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="训练回顾" />
      <View style={styles.reportGrid}>
        <View style={styles.reportItem}>
          <Text style={styles.cardLabel}>今天</Text>
          <Text style={styles.reportText}>
            {snapshot?.prepared_expression?.training_reports?.daily_summary?.summary
              ?? '完成练习后，今天最值得继续的重点会出现在这里。'}
          </Text>
        </View>
        <View style={styles.reportItem}>
          <Text style={styles.cardLabel}>最近 7 天</Text>
          <Text style={styles.reportText}>
            {snapshot?.prepared_expression?.training_reports?.weekly_summary?.summary
              ?? '积累几次练习后，再看稳定规律，不急着给自己下结论。'}
          </Text>
        </View>
      </View>
      </> : null}

      {section === 'materials' ? <>
        <View style={styles.sectionIntro}>
          <Text style={styles.sectionTitle}>自定义材料</Text>
          <Text style={styles.mutedText}>保存后会同步到 Web，并可直接进入训练切句。</Text>
        </View>
        {(editor.library?.assets ?? []).map((asset) => {
          const active = editor.library?.active_asset_id === asset.draft.id
          return (
            <View key={asset.draft.id} style={[styles.libraryItem, active ? styles.libraryItemActive : null]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardTitle}>{asset.draft.title}</Text>
                  <Text numberOfLines={2} style={styles.mutedText}>{asset.structured.summary}</Text>
                </View>
                {active ? <Text style={styles.activeBadge}>正在使用</Text> : null}
              </View>
              <View style={styles.actionRow}>
                {!active ? <SecondaryButton label="设为当前" onPress={() => void editor.activateMaterial(asset.draft.id).then(onRefresh)} /> : null}
                <SecondaryButton label="编辑" onPress={() => editMaterial(asset.draft.id)} />
                <SecondaryButton destructive label="删除" onPress={() => Alert.alert(
                  '删除这份材料？',
                  'Web 和 App 中都会删除，无法恢复。',
                  [
                    { text: '取消', style: 'cancel' },
                    { text: '删除', style: 'destructive', onPress: () => void editor.deleteMaterial(asset.draft.id).then(onRefresh) },
                  ],
                )} />
              </View>
            </View>
          )
        })}
        <View style={styles.editorPanel}>
          <Text style={styles.cardTitle}>{materialId ? '编辑材料' : '新增材料'}</Text>
          <TextInput accessibilityLabel="材料标题" editable={!busy} onChangeText={setMaterialTitle} placeholder="例如：下次复诊要说的话" placeholderTextColor={COLORS.subtle} style={styles.input} value={materialTitle} />
          <TextInput accessibilityLabel="材料正文" editable={!busy} multiline onChangeText={setMaterialContent} placeholder="粘贴或输入完整材料" placeholderTextColor={COLORS.subtle} style={[styles.practiceInput, styles.materialInput]} value={materialContent} />
          <View style={styles.actionRow}>
            {materialId ? <SecondaryButton label="取消编辑" onPress={() => editMaterial(undefined)} /> : null}
            <PrimaryButton disabled={busy || !materialTitle.trim() || !materialContent.trim()} label={busy ? '正在保存…' : '保存材料'} onPress={() => void saveMaterial()} />
          </View>
        </View>
      </> : null}

      {section === 'profile' ? <View style={styles.editorPanel}>
        <Text style={styles.cardTitle}>我的沟通画像</Text>
        <Text style={styles.mutedText}>只写对沟通有帮助的事实，不需要医学化描述自己。</Text>
        <Text style={styles.fieldLabel}>希望别人怎样理解我</Text>
        <TextInput accessibilityLabel="沟通画像" editable={!busy} multiline onChangeText={setProfileDocument} placeholder="例如：我理解没有问题，但需要更多时间把话说完整。" placeholderTextColor={COLORS.subtle} style={styles.practiceInput} value={profileDocument} />
        <Text style={styles.fieldLabel}>常见场景（每行一项）</Text>
        <TextInput accessibilityLabel="常见沟通场景" editable={!busy} multiline onChangeText={setProfileScenarios} placeholder="工作会议\n就医沟通" placeholderTextColor={COLORS.subtle} style={styles.practiceInput} value={profileScenarios} />
        <Text style={styles.fieldLabel}>有效支持方式（每行一项）</Text>
        <TextInput accessibilityLabel="有效支持方式" editable={!busy} multiline onChangeText={setProfileStrategies} placeholder="让我先说完\n必要时看手机文字" placeholderTextColor={COLORS.subtle} style={styles.practiceInput} value={profileStrategies} />
        <PrimaryButton disabled={busy} label={busy ? '正在保存…' : '保存画像'} onPress={() => void editor.saveProfile({
          ...snapshot?.user_profile_memory,
          document: profileDocument.trim(),
          common_scenarios: splitLines(profileScenarios),
          support_strategies: splitLines(profileStrategies),
        }).then((saved) => { if (saved) onRefresh() })} />
      </View> : null}

      {section === 'phrases' ? <>
        <View style={styles.sectionIntro}>
          <Text style={styles.sectionTitle}>常用短句</Text>
          <Text style={styles.mutedText}>沟通页和 Web 会使用同一份短句。</Text>
        </View>
        {editor.phrases.map((phrase) => (
          <View key={phrase.id} style={styles.phraseEditorRow}>
            <Text style={styles.preparedText}>{phrase.text}</Text>
            <View style={styles.compactActions}>
              <SecondaryButton compact label="编辑" onPress={() => { setPhraseId(phrase.id); setPhraseText(phrase.text) }} />
              <SecondaryButton compact destructive label="删除" onPress={() => Alert.alert(
                '删除这条短句？',
                'Web 和 App 中都会删除。',
                [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void editor.deletePhrase(phrase.id).then(onRefresh) }],
              )} />
            </View>
          </View>
        ))}
        <View style={styles.editorPanel}>
          <Text style={styles.cardTitle}>{phraseId ? '编辑短句' : '新增短句'}</Text>
          <TextInput accessibilityLabel="常用短句内容" editable={!busy} onChangeText={setPhraseText} placeholder="例如：请让我把这句话说完" placeholderTextColor={COLORS.subtle} style={styles.input} value={phraseText} />
          <View style={styles.actionRow}>
            {phraseId ? <SecondaryButton label="取消" onPress={() => { setPhraseId(undefined); setPhraseText('') }} /> : null}
            <PrimaryButton disabled={busy || !phraseText.trim()} label={busy ? '正在保存…' : '保存短句'} onPress={() => void editor.savePhrase({ id: phraseId, text: phraseText.trim() }).then((saved) => {
              if (saved) { setPhraseId(undefined); setPhraseText(''); onRefresh() }
            })} />
          </View>
        </View>
      </> : null}

      {editor.errorMessage ? <InlineMessage tone="danger" text={editor.errorMessage} /> : null}
    </View>
  )
}

function AccountScreen({
  apiConfigured,
  auth,
  diagnosticStatus,
  onRequestPermission,
  onSendDiagnostics,
  onSignOut,
  onSync,
  pendingDiagnosticCount,
  permissionStatus,
  phoneAuthEnabled,
  queueCount,
  workspaceReady,
}: {
  apiConfigured: boolean
  auth: ReturnType<typeof useMobileAuth>
  diagnosticStatus: MobileDiagnosticSyncStatus
  onRequestPermission(): void
  onSendDiagnostics(): void
  onSignOut(): void
  onSync(): void
  pendingDiagnosticCount: number
  permissionStatus: string
  phoneAuthEnabled: boolean
  queueCount: number
  workspaceReady: boolean
}) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [bindingCodeSent, setBindingCodeSent] = useState(false)
  const [bindingMessage, setBindingMessage] = useState(
    '绑定后，邮箱和手机号都可以登录同一个账号。',
  )
  const isBinding = auth.status === 'binding_phone'

  const requestBindingCode = async (): Promise<void> => {
    let normalizedPhone: string
    try {
      normalizedPhone = normalizeMainlandPhone(phone)
    } catch {
      setBindingMessage('手机号格式不正确。')
      return
    }

    const requested = await auth.requestPhoneBindingCode(normalizedPhone)
    if (requested) {
      setBindingCodeSent(true)
      setBindingMessage(`验证码已发送至 ${displayMainlandPhone(normalizedPhone)}，5 分钟内有效。`)
    }
  }

  const verifyBindingCode = async (): Promise<void> => {
    let normalizedPhone: string
    try {
      normalizedPhone = normalizeMainlandPhone(phone)
    } catch {
      setBindingMessage('手机号格式不正确。')
      return
    }
    if (!/^\d{6}$/.test(otp)) {
      setBindingMessage('请输入短信中的 6 位验证码。')
      return
    }

    const verified = await auth.verifyPhoneBindingCode({ phone: normalizedPhone, otp })
    if (verified) {
      setBindingCodeSent(false)
      setOtp('')
      setBindingMessage('手机号已绑定，原邮箱和全部数据保持不变。')
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.heroHeading}>
        <Text style={styles.eyebrow}>我的</Text>
        <Text style={styles.pageTitle}>账户与设备</Text>
        <Text style={styles.pageCopy}>只保留开始沟通前真正需要确认的状态。</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>V</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileEmail}>
            {auth.user?.email ?? auth.user?.phone ?? 'VoxFlame 用户'}
          </Text>
          <Text style={styles.mutedText}>VoxFlame 账户</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardLabel}>更多登录选择</Text>
          <Text style={styles.cardTitle}>手机号登录</Text>
          <Text style={styles.mutedText}>邮箱登录会继续保留，手机号只是同一账号的另一种入口。</Text>
        </View>
        {auth.user?.phone ? (
          <InlineMessage
            tone="success"
            text={`已绑定 ${displayMainlandPhone(auth.user.phone)}，现在可以使用短信验证码登录。`}
          />
        ) : phoneAuthEnabled ? (
          <>
            <Text style={styles.fieldLabel}>中国大陆手机号</Text>
            <TextInput
              accessibilityLabel="绑定中国大陆手机号"
              editable={!isBinding && !bindingCodeSent}
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="138 1234 5678"
              placeholderTextColor={COLORS.subtle}
              style={styles.input}
              textContentType="telephoneNumber"
              value={phone}
            />
            {bindingCodeSent ? (
              <>
                <Text style={styles.fieldLabel}>6 位验证码</Text>
                <TextInput
                  accessibilityLabel="绑定验证码"
                  editable={!isBinding}
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="短信验证码"
                  placeholderTextColor={COLORS.subtle}
                  style={[styles.input, styles.otpInput]}
                  textContentType="oneTimeCode"
                  value={otp}
                />
              </>
            ) : null}
            <Text style={styles.loginHint}>{bindingMessage}</Text>
            {friendlyError(auth.errorMessage) ? (
              <InlineMessage tone="danger" text={friendlyError(auth.errorMessage) ?? ''} />
            ) : null}
            <PrimaryButton
              disabled={isBinding}
              label={isBinding
                ? '正在处理…'
                : bindingCodeSent ? '确认绑定' : '发送绑定验证码'}
              onPress={() => void (bindingCodeSent ? verifyBindingCode() : requestBindingCode())}
            />
            {bindingCodeSent ? (
              <Pressable
                accessibilityRole="button"
                disabled={isBinding}
                onPress={() => {
                  setBindingCodeSent(false)
                  setOtp('')
                  setBindingMessage('可以修改手机号后重新发送验证码。')
                }}
                style={styles.textAction}
              >
                <Text style={styles.textActionText}>修改手机号</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.loginHint}>手机号登录尚未开放，现有邮箱登录不受影响。</Text>
        )}
      </View>

      <View style={styles.settingList}>
        <SettingRow
          action="检查"
          label="麦克风权限"
          onPress={onRequestPermission}
          value={permissionLabel(permissionStatus)}
        />
        <SettingRow
          action="同步"
          label="沟通资料"
          onPress={onSync}
          value={workspaceReady ? '已同步' : '等待同步'}
        />
        <SettingRow
          label="待上传录音"
          value={`${queueCount} 条`}
        />
        <SettingRow
          label="在线服务"
          value={apiConfigured ? '可用' : '暂不可用'}
        />
        <SettingRow
          action="发送"
          label="自动诊断"
          onPress={onSendDiagnostics}
          value={diagnosticLabel(diagnosticStatus, pendingDiagnosticCount)}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onSignOut}
        style={({ pressed }) => [styles.signOutButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.signOutText}>退出登录</Text>
      </Pressable>
      <Text style={styles.privacyCopy}>
        本地录音在你删除前会保留在这台设备上。诊断不包含录音、转写、聊天内容或登录凭据。
      </Text>
    </View>
  )
}

function BottomNavigation({
  activeSurfaceId,
  onChange,
}: {
  activeSurfaceId: MobileWorkbenchSurfaceId
  onChange(surfaceId: MobileWorkbenchSurfaceId): void
}) {
  return (
    <View accessibilityRole="tablist" style={styles.bottomNavigation}>
      {MOBILE_WORKBENCH_SURFACES.map((surface) => {
        const active = surface.id === activeSurfaceId
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={surface.id}
            onPress={() => onChange(surface.id)}
            style={({ pressed }) => [styles.navItem, pressed ? styles.pressed : null]}
          >
            <View style={[styles.navMark, active ? styles.navMarkActive : null]} />
            <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>
              {surface.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function PrimaryButton({
  disabled = false,
  label,
  onPress,
  tone = 'accent',
}: {
  disabled?: boolean
  label: string
  onPress(): void
  tone?: 'accent' | 'neutral'
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        tone === 'neutral' ? styles.primaryButtonNeutral : null,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  )
}

function SecondaryButton({
  compact = false,
  destructive = false,
  disabled = false,
  label,
  onPress,
}: {
  compact?: boolean
  destructive?: boolean
  disabled?: boolean
  label: string
  onPress(): void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        compact ? styles.secondaryButtonCompact : null,
        destructive ? styles.secondaryButtonDestructive : null,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[
        styles.secondaryButtonText,
        destructive ? styles.secondaryButtonTextDestructive : null,
      ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function SectionHeader({ title, aside }: { title: string; aside?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {aside ? <Text style={styles.sectionAside}>{aside}</Text> : null}
    </View>
  )
}

function InlineMessage({ text, tone }: { text: string; tone: 'danger' | 'success' }) {
  return (
    <View style={[
      styles.inlineMessage,
      tone === 'success' ? styles.inlineMessageSuccess : styles.inlineMessageDanger,
    ]}
    >
      <Text style={[
        styles.inlineMessageText,
        tone === 'success' ? styles.inlineMessageTextSuccess : styles.inlineMessageTextDanger,
      ]}
      >
        {text}
      </Text>
    </View>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  )
}

function SettingRow({
  action,
  label,
  onPress,
  value,
}: {
  action?: string
  label: string
  onPress?: () => void
  value: string
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{value}</Text>
      </View>
      {action && onPress ? (
        <Pressable
          accessibilityLabel={`${action}${label}`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.inlineAction, pressed ? styles.pressed : null]}
        >
          <Text style={styles.inlineActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  appShell: { flex: 1 },
  content: { flex: 1 },
  pageContent: { paddingHorizontal: 20, paddingBottom: 32 },
  screen: { gap: 18 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 12,
  },
  wordmark: { color: COLORS.ink, fontSize: 18, fontWeight: '800' },
  headerEmail: { color: COLORS.muted, fontSize: 11, marginTop: 2, maxWidth: 180 },
  statusBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusDot: { backgroundColor: COLORS.success, borderRadius: 999, height: 6, width: 6 },
  statusBadgeText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  heroHeading: { paddingBottom: 4, paddingTop: 18 },
  eyebrow: { color: COLORS.accent, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  pageTitle: { color: COLORS.ink, fontSize: 29, fontWeight: '800', lineHeight: 37 },
  pageCopy: { color: COLORS.muted, fontSize: 15, lineHeight: 23, marginTop: 8 },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  communicationCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 18,
    padding: 20,
  },
  sceneBar: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  sceneBarCopy: { flex: 1 },
  connectionRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  liveDot: { backgroundColor: COLORS.subtle, borderRadius: 999, height: 8, width: 8 },
  liveDotActive: { backgroundColor: COLORS.success },
  connectionText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  displayPhrase: { color: COLORS.ink, fontSize: 25, fontWeight: '700', lineHeight: 37 },
  liveTranscript: { color: COLORS.ink, fontSize: 21, fontWeight: '700', lineHeight: 31 },
  outputActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outputStatus: { color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  partnerView: {
    alignItems: 'center',
    backgroundColor: COLORS.ink,
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  partnerLabel: { color: '#D6CEC6', fontSize: 16, fontWeight: '700' },
  partnerText: { color: '#FFFFFF', fontSize: 42, fontWeight: '800', lineHeight: 58, textAlign: 'center' },
  partnerCloseButton: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  partnerCloseText: { color: COLORS.ink, fontSize: 15, fontWeight: '800' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonNeutral: { backgroundColor: COLORS.ink },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  secondaryButtonCompact: { flex: 0, minHeight: 40, paddingHorizontal: 14 },
  secondaryButtonDestructive: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerSoft },
  secondaryButtonText: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  secondaryButtonTextDestructive: { color: COLORS.danger },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '800' },
  sectionAside: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  sectionSummary: { color: COLORS.muted, fontSize: 14, lineHeight: 22, marginTop: -10 },
  phraseList: { gap: 8 },
  phraseButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: 16,
  },
  phraseButtonActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accentSoft },
  phraseButtonText: { color: COLORS.ink, flex: 1, fontSize: 15, lineHeight: 22 },
  phraseArrow: { color: COLORS.accent, fontSize: 24, marginLeft: 12 },
  fieldLabel: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  input: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: COLORS.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  practiceInput: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    color: COLORS.ink,
    fontSize: 17,
    lineHeight: 26,
    minHeight: 92,
    padding: 14,
    textAlignVertical: 'top',
  },
  taskCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 9,
    padding: 18,
  },
  taskCardEyebrow: { color: COLORS.accent, fontSize: 12, fontWeight: '800' },
  taskCardTitle: { color: COLORS.ink, fontSize: 21, fontWeight: '800', lineHeight: 29 },
  taskCardCopy: { color: COLORS.muted, fontSize: 14, lineHeight: 22 },
  trainingStage: { backgroundColor: COLORS.ink, borderRadius: 24, gap: 18, padding: 22 },
  trainingProgressRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  trainingProgressText: { color: '#CFC7BF', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '800' },
  trainingTarget: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', lineHeight: 43 },
  feedbackPanel: { backgroundColor: '#312A25', borderRadius: 16, gap: 6, padding: 15 },
  feedbackLabel: { color: '#D4A68E', fontSize: 12, fontWeight: '800' },
  feedbackHeard: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', lineHeight: 30 },
  feedbackSummary: { color: '#E9E2DB', fontSize: 14, lineHeight: 21 },
  assessmentProgress: { backgroundColor: COLORS.surfaceMuted, borderRadius: 14, gap: 4, padding: 14 },
  stepActions: { flexDirection: 'row', gap: 8 },
  customPracticePanel: { borderTopColor: COLORS.border, borderTopWidth: 1, gap: 10, paddingTop: 18 },
  recordingDisclosure: { alignItems: 'center', borderTopColor: COLORS.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56 },
  categoryList: { gap: 8, marginTop: 6 },
  categoryRow: {
    alignItems: 'center',
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  categoryCopy: { flex: 1, gap: 3 },
  categoryTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '800' },
  categoryCount: { color: COLORS.accent, fontSize: 12, fontWeight: '800' },
  exerciseList: { gap: 8 },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  exerciseRowActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  exerciseIndex: { color: COLORS.accent, fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '800' },
  exerciseText: { color: COLORS.ink, flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  recordingMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  recordingMetaText: { color: COLORS.muted, fontSize: 13 },
  timer: { color: COLORS.ink, fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '800' },
  recordingList: { gap: 10 },
  recordingItem: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 15,
  },
  recordingText: { color: COLORS.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  recordingItemMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  mutedText: { color: COLORS.muted, fontSize: 13, lineHeight: 20 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineMessage: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  inlineMessageDanger: { backgroundColor: COLORS.dangerSoft },
  inlineMessageSuccess: { backgroundColor: COLORS.successSoft },
  inlineMessageText: { fontSize: 13, lineHeight: 19 },
  inlineMessageTextDanger: { color: COLORS.danger },
  inlineMessageTextSuccess: { color: COLORS.success },
  emptyState: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  emptyStateText: { color: COLORS.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  cardHeaderCopy: { flex: 1 },
  cardLabel: { color: COLORS.accent, fontSize: 12, fontWeight: '800', marginBottom: 7 },
  cardTitle: { color: COLORS.ink, fontSize: 20, fontWeight: '800', lineHeight: 29 },
  preparedList: { gap: 8 },
  preparedItem: {
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 15,
  },
  preparedIndex: { color: COLORS.accent, fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '800', paddingTop: 3 },
  preparedText: { color: COLORS.ink, flex: 1, fontSize: 15, lineHeight: 23 },
  segmentedTabs: { backgroundColor: '#EAE4DC', borderRadius: 14, flexDirection: 'row', gap: 3, padding: 4 },
  segmentedTab: { alignItems: 'center', borderRadius: 10, flex: 1, justifyContent: 'center', minHeight: 42 },
  segmentedTabActive: { backgroundColor: COLORS.surface },
  segmentedTabText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  segmentedTabTextActive: { color: COLORS.ink, fontWeight: '800' },
  sectionIntro: { gap: 5, paddingTop: 2 },
  libraryItem: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, gap: 13, padding: 16 },
  libraryItemActive: { borderColor: COLORS.accent },
  activeBadge: { backgroundColor: COLORS.accentSoft, borderRadius: 999, color: COLORS.accent, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 },
  editorPanel: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 20, borderWidth: 1, gap: 13, padding: 17 },
  materialInput: { minHeight: 180 },
  phraseEditorRow: { alignItems: 'flex-start', backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14 },
  compactActions: { flexDirection: 'row', gap: 6 },
  reportGrid: { gap: 10 },
  reportItem: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderRadius: 16, borderWidth: 1, padding: 16 },
  reportText: { color: COLORS.ink, fontSize: 14, lineHeight: 23 },
  trainingReportPreview: { gap: 10, paddingTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: COLORS.accentSoft, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  chipText: { color: '#6E3A24', fontSize: 13, fontWeight: '700' },
  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: COLORS.ink,
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  profileCopy: { flex: 1 },
  profileEmail: { color: COLORS.ink, fontSize: 15, fontWeight: '800' },
  settingList: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  settingRow: {
    alignItems: 'center',
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 68,
  },
  settingCopy: { flex: 1 },
  settingLabel: { color: COLORS.ink, fontSize: 15, fontWeight: '700' },
  settingValue: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  inlineAction: { justifyContent: 'center', minHeight: 44, paddingLeft: 18 },
  inlineActionText: { color: COLORS.accent, fontSize: 14, fontWeight: '800' },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  signOutText: { color: COLORS.danger, fontSize: 15, fontWeight: '800' },
  bottomNavigation: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 7,
  },
  navItem: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 52 },
  navMark: { backgroundColor: COLORS.subtle, borderRadius: 999, height: 5, marginBottom: 7, width: 5 },
  navMarkActive: { backgroundColor: COLORS.accent, width: 20 },
  navLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  navLabelActive: { color: COLORS.ink },
  loginPage: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  brandMark: {
    alignItems: 'center',
    backgroundColor: COLORS.ink,
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginBottom: 24,
    width: 52,
  },
  brandMarkText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  loginTitle: { color: COLORS.ink, fontSize: 31, fontWeight: '800', lineHeight: 40 },
  loginCopy: { color: COLORS.muted, fontSize: 15, lineHeight: 23, marginTop: 10 },
  loginCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 11,
    marginTop: 30,
    padding: 18,
  },
  loginMethodRow: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  loginMethodTab: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  loginMethodTabActive: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  loginMethodText: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  loginMethodTextActive: { color: COLORS.ink },
  loginHint: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 10,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  otpInput: { fontSize: 20, letterSpacing: 8, textAlign: 'center' },
  phoneCodeActions: { flexDirection: 'row', justifyContent: 'space-between' },
  textAction: { alignItems: 'center', justifyContent: 'center', minHeight: 40, paddingHorizontal: 4 },
  textActionText: { color: COLORS.accent, fontSize: 13, fontWeight: '800' },
  privacyCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 14, textAlign: 'center' },
})
