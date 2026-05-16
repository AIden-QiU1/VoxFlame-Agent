import React, {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'

import { getMobileRuntimeConfig } from './src/api/mobile-config'
import { useMobileAuth } from './src/auth/use-mobile-auth'
import {
  MOBILE_WORKBENCH_SURFACES,
  type MobileWorkbenchSurfaceId,
} from './src/constants/surfaces'
import { useNativeRecorderQueue } from './src/queue/use-native-recorder-queue'
import { useLiveKitRoomConnection } from './src/realtime/use-livekit-room-connection'
import { buildMobileWorkbenchRtcSessionIntent } from './src/realtime/rtc-session-intent'
import { useMobileRtcSession } from './src/realtime/use-mobile-rtc-session'
import { useMobileWorkspaceSnapshot } from './src/workspace/use-mobile-workspace'

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

function statusLabel(status: string): string {
  if (status === 'requires_backend') {
    return '待接 RTC'
  }

  if (status === 'native_boundary') {
    return '待真机'
  }

  if (status === 'ready_for_contract') {
    return '可同步'
  }

  return '已预留'
}

function surfaceCopy(surfaceId: MobileWorkbenchSurfaceId): string {
  if (surfaceId === 'communication') {
    return '把当前最重要的一句话放到最前面。'
  }

  if (surfaceId === 'practice') {
    return '每天先练一小组，断网时先留在本机。'
  }

  if (surfaceId === 'memory') {
    return '读取 Web 端同一份沟通档案和准备材料。'
  }

  return '检查权限、同步状态和本地补传队列。'
}

function authStatusLabel(status: string): string {
  if (status === 'config_missing') {
    return '缺少配置'
  }

  if (status === 'initializing') {
    return '检查登录'
  }

  if (status === 'signed_in') {
    return '已登录'
  }

  if (status === 'signing_in') {
    return '登录中'
  }

  if (status === 'signing_out') {
    return '退出中'
  }

  if (status === 'error') {
    return '需要处理'
  }

  return '未登录'
}

function workspaceStatusLabel(status: string): string {
  if (status === 'ready') {
    return '已同步'
  }

  if (status === 'loading') {
    return '同步中'
  }

  if (status === 'error') {
    return '同步失败'
  }

  if (status === 'config_missing') {
    return '缺少 API'
  }

  if (status === 'auth_required') {
    return '等待登录'
  }

  return '待同步'
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export default function App() {
  const config = useMemo(() => getMobileRuntimeConfig(), [])
  const auth = useMobileAuth(config)
  const workspace = useMobileWorkspaceSnapshot({
    apiBaseUrl: config.apiBaseUrl,
    userId: auth.user?.id ?? null,
    tokenProvider: auth.tokenProvider,
    enabled: auth.status === 'signed_in',
  })
  const [activeSurfaceId, setActiveSurfaceId] =
    useState<MobileWorkbenchSurfaceId>('communication')
  const [practiceText, setPracticeText] = useState('')
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
  const activeSurface = MOBILE_WORKBENCH_SURFACES.find(
    (surface) => surface.id === activeSurfaceId,
  ) ?? MOBILE_WORKBENCH_SURFACES[0]
  const rtcIntent = useMemo(
    () => buildMobileWorkbenchRtcSessionIntent({
      surfaceId: activeSurfaceId,
      scene: activeSurfaceId === 'communication' ? 'work' : undefined,
      deviceContext: {
        microphoneStatus: 'unknown',
        networkOnline: true,
        appState: 'active',
      },
    }),
    [activeSurfaceId],
  )
  const preparedLines = workspace.readModel.priorityLines.length > 0
    ? workspace.readModel.priorityLines
    : LOCAL_PREPARED_LINES
  const quickPhrases = workspace.readModel.quickPhrases.length > 0
    ? workspace.readModel.quickPhrases
    : LOCAL_QUICK_PHRASES
  const canRefreshWorkspace = auth.status === 'signed_in'
    && Boolean(config.apiBaseUrl)
  const selectedPracticeLine = practiceText.trim()
    || preparedLines[0]
    || '移动端练习样本'
  const canUseRecorder = auth.status === 'signed_in'

  const handlePrimaryAction = (): void => {
    if (activeSurfaceId === 'communication') {
      if (liveKitRoom.status === 'connected' || liveKitRoom.status === 'reconnecting') {
        void liveKitRoom.disconnect()
        return
      }

      if (rtcSession.session && rtcSession.status === 'ready') {
        void liveKitRoom.connect(rtcSession.session)
        return
      }

      void rtcSession.start(rtcIntent).then((session) => {
        if (session) {
          void liveKitRoom.connect(session)
        }
      })
      return
    }

    if (activeSurfaceId === 'memory') {
      workspace.refresh()
      return
    }

    if (activeSurfaceId === 'practice') {
      if (recorderQueue.isRecording) {
        void recorderQueue.stopRecording()
        return
      }

      void recorderQueue.startRecording(selectedPracticeLine)
      return
    }

    if (activeSurfaceId === 'device') {
      void recorderQueue.requestPermission()
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <View style={styles.header}>
          <Text style={styles.kicker}>VoxFlame</Text>
          <Text style={styles.title}>移动端工作台</Text>
          <Text style={styles.subtitle}>
            常用句、练习目标和准备材料保持同步。
          </Text>
        </View>

        <AuthPanel
          auth={auth}
          apiConfigured={Boolean(config.apiBaseUrl)}
          workspaceStatus={workspaceStatusLabel(workspace.status)}
          workspaceError={workspace.errorMessage}
          onRefreshWorkspace={workspace.refresh}
          canRefreshWorkspace={canRefreshWorkspace}
        />

        <View style={styles.tabBar}>
          {MOBILE_WORKBENCH_SURFACES.map((surface) => {
            const isActive = surface.id === activeSurfaceId
            return (
              <TouchableOpacity
                key={surface.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveSurfaceId(surface.id)}
                style={[
                  styles.tabButton,
                  isActive ? styles.tabButtonActive : null,
                ]}
              >
                <Text style={[
                  styles.tabLabel,
                  isActive ? styles.tabLabelActive : null,
                ]}
                >
                  {surface.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
        >
          <View style={styles.surfacePanel}>
            <View style={styles.surfaceHeader}>
              <Text style={styles.surfaceTitle}>{activeSurface.title}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>
                  {statusLabel(activeSurface.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.surfaceCopy}>
              {surfaceCopy(activeSurfaceId)}
            </Text>
            <TouchableOpacity
              disabled={
                (activeSurfaceId === 'communication' && !rtcSession.canStart)
                || (activeSurfaceId === 'memory' && !canRefreshWorkspace)
                || (activeSurfaceId === 'practice' && !canUseRecorder)
              }
              onPress={handlePrimaryAction}
              style={[
                styles.primaryButton,
                activeSurfaceId === 'communication' && !rtcSession.canStart
                  ? styles.buttonDisabled
                  : null,
                activeSurfaceId === 'memory' && !canRefreshWorkspace
                  ? styles.buttonDisabled
                  : null,
                activeSurfaceId === 'practice' && !canUseRecorder
                  ? styles.buttonDisabled
                  : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {activeSurfaceId === 'memory'
                  ? '刷新准备材料'
                  : activeSurfaceId === 'communication' && liveKitRoom.status === 'connected'
                    ? '断开房间'
                    : activeSurfaceId === 'communication' && liveKitRoom.status === 'connecting'
                      ? '连接中'
                  : activeSurfaceId === 'communication' && rtcSession.status === 'starting'
                    ? '创建会话中'
                  : activeSurfaceId === 'practice' && recorderQueue.isRecording
                    ? '停止并保存'
                    : activeSurface.primaryAction}
              </Text>
            </TouchableOpacity>
          </View>

          {activeSurfaceId === 'communication' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>沟通会话</Text>
              <View style={styles.metricRow}>
                <Metric label="模式" value={rtcIntent.mode} />
                <Metric label="策略" value={rtcIntent.sessionStrategy} />
              </View>
              <View style={styles.recorderPanel}>
                <Text style={styles.sectionLead}>LiveKit 准备状态</Text>
                <View style={styles.metricRow}>
                  <Metric label="会话" value={rtcSession.status} />
                  <Metric
                    label="Backend"
                    value={rtcSession.canStart ? '可请求' : '等待登录'}
                  />
                </View>
                <View style={styles.metricRow}>
                  <Metric label="Room" value={liveKitRoom.status} />
                  <Metric
                    label="麦克风"
                    value={liveKitRoom.microphoneEnabled ? '已发布' : '未发布'}
                  />
                </View>
                {rtcSession.session ? (
                  <View style={styles.lineItem}>
                    <Text style={styles.lineText}>
                      Room: {rtcSession.session.transport.roomName}
                    </Text>
                    <Text style={styles.mutedText}>
                      {rtcSession.session.readiness.canStart
                        ? 'backend 已返回 participant token，可进入 React Native room。'
                        : 'backend 返回了 blocker，需要先处理后再进房间。'}
                    </Text>
                    {liveKitRoom.roomName ? (
                      <Text style={styles.mutedText}>
                        当前房间：{liveKitRoom.roomName}
                      </Text>
                    ) : null}
                    {rtcSession.session.readiness.blockers.length > 0 ? (
                      <Text style={styles.errorText}>
                        {rtcSession.session.readiness.blockers.join(' / ')}
                      </Text>
                    ) : null}
                    {rtcSession.session.readiness.warnings.length > 0 ? (
                      <Text style={styles.mutedText}>
                        {rtcSession.session.readiness.warnings.join(' / ')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {rtcSession.errorMessage ? (
                  <Text style={styles.errorText}>
                    {rtcSession.errorMessage}
                  </Text>
                ) : null}
                {liveKitRoom.errorMessage ? (
                  <Text style={styles.errorText}>
                    {liveKitRoom.errorMessage}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {activeSurfaceId === 'practice' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>练习队列</Text>
              <View style={styles.metricRow}>
                <Metric label="本地" value={recorderQueue.summary.localOnly} />
                <Metric label="待传" value={recorderQueue.summary.uploadPending} />
                <Metric label="失败" value={recorderQueue.summary.failed} />
              </View>
              <Text style={styles.mutedText}>
                {recorderQueue.summary.nextAction}
              </Text>
              <Text style={styles.mutedText}>
                今日目标：{workspace.readModel.dailyTargetCount} 句
              </Text>
              <View style={styles.recorderPanel}>
                <Text style={styles.sectionLead}>本次练习句</Text>
                <TextInput
                  editable={!recorderQueue.isRecording}
                  multiline
                  onChangeText={setPracticeText}
                  placeholder={preparedLines[0] ?? '输入要练习的一句话'}
                  placeholderTextColor="#9b9085"
                  style={styles.practiceInput}
                  value={practiceText}
                />
                <View style={styles.authStatusRow}>
                  <Metric
                    label="麦克风"
                    value={recorderQueue.permissionStatus}
                  />
                  <Metric
                    label="时长"
                    value={formatDuration(recorderQueue.durationMs)}
                  />
                </View>
                {recorderQueue.errorMessage ? (
                  <Text style={styles.errorText}>
                    {recorderQueue.errorMessage}
                  </Text>
                ) : null}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    disabled={!canUseRecorder}
                    onPress={() => {
                      void recorderQueue.requestPermission()
                    }}
                    style={[
                      styles.secondaryButton,
                      !canUseRecorder ? styles.buttonDisabled : null,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>权限</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={!recorderQueue.latestItem}
                    onPress={recorderQueue.playLatest}
                    style={[
                      styles.secondaryButton,
                      !recorderQueue.latestItem ? styles.buttonDisabled : null,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {recorderQueue.isPlayingLatest ? '播放中' : '回放'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {recorderQueue.latestItem ? (
                  <View style={styles.lineItem}>
                    <Text style={styles.lineText}>
                      {recorderQueue.latestItem.text}
                    </Text>
                    <Text style={styles.mutedText}>
                      {recorderQueue.latestItem.syncStatus}
                      {' · '}
                      {recorderQueue.latestItem.recording.audio.quality?.disposition ?? 'quality_pending'}
                      {' · '}
                      {formatDuration(
                        recorderQueue.latestItem.recording.audio.durationMs,
                      )}
                      {' · '}
                      {Math.round(
                        recorderQueue.latestItem.recording.audio.fileSizeBytes / 1024,
                      )}
                      KB
                    </Text>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        disabled={
                          recorderQueue.latestItem.syncStatus === 'uploaded'
                          || recorderQueue.uploadingRecordingId === recorderQueue.latestItem.recordingId
                        }
                        onPress={() => {
                          if (recorderQueue.latestItem) {
                            void recorderQueue.uploadRecording(
                              recorderQueue.latestItem.recordingId,
                            )
                          }
                        }}
                        style={[
                          styles.secondaryButton,
                          recorderQueue.latestItem.syncStatus === 'uploaded'
                            || recorderQueue.uploadingRecordingId === recorderQueue.latestItem.recordingId
                            ? styles.buttonDisabled
                            : null,
                        ]}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {recorderQueue.uploadingRecordingId === recorderQueue.latestItem.recordingId
                            ? '上传中'
                            : recorderQueue.latestItem.syncStatus === 'uploaded'
                              ? '已上传'
                              : '上传'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={recorderQueue.uploadingRecordingId === recorderQueue.latestItem.recordingId}
                        onPress={() => {
                          if (recorderQueue.latestItem) {
                            void recorderQueue.discard(
                              recorderQueue.latestItem.recordingId,
                            )
                          }
                        }}
                        style={[
                          styles.secondaryButton,
                          recorderQueue.uploadingRecordingId === recorderQueue.latestItem.recordingId
                            ? styles.buttonDisabled
                            : null,
                        ]}
                      >
                        <Text style={styles.secondaryButtonText}>丢弃</Text>
                      </TouchableOpacity>
                    </View>
                    {recorderQueue.latestItem.uploadReceipt?.message ? (
                      <Text style={styles.successText}>
                        {recorderQueue.latestItem.uploadReceipt.message}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {recorderQueue.lastUploadReceipt ? (
                  <Text style={styles.successText}>
                    {recorderQueue.lastUploadReceipt.message}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {activeSurfaceId === 'memory' ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>准备材料</Text>
                <Text style={styles.inlineStatus}>
                  {workspaceStatusLabel(workspace.status)}
                </Text>
              </View>
              {workspace.readModel.preparedTitle ? (
                <Text style={styles.sectionLead}>
                  {workspace.readModel.preparedTitle}
                </Text>
              ) : null}
              {workspace.readModel.preparedSummary ? (
                <Text style={styles.mutedText}>
                  {workspace.readModel.preparedSummary}
                </Text>
              ) : null}
              {preparedLines.map((line) => (
                <View key={line} style={styles.lineItem}>
                  <Text style={styles.lineText}>{line}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {activeSurfaceId === 'device' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>设备状态</Text>
              <View style={styles.deviceGrid}>
                <Metric label="麦克风" value={recorderQueue.permissionStatus} />
                <Metric label="补传" value={recorderQueue.summary.uploadPending} />
              </View>
              <Text style={styles.mutedText}>
                点“检查麦克风”会触发系统权限检查；练习录音会把时长质量写入本地队列和上传 metadata。
              </Text>
              {recorderQueue.errorMessage ? (
                <Text style={styles.errorText}>
                  {recorderQueue.errorMessage}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>快捷短句</Text>
            <View style={styles.phraseWrap}>
              {quickPhrases.map((phrase) => (
                <View key={phrase} style={styles.phraseChip}>
                  <Text style={styles.phraseText}>{phrase}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

function AuthPanel(props: {
  auth: ReturnType<typeof useMobileAuth>
  apiConfigured: boolean
  workspaceStatus: string
  workspaceError: string | null
  canRefreshWorkspace: boolean
  onRefreshWorkspace(): void
}) {
  const {
    auth,
    apiConfigured,
    workspaceStatus,
    workspaceError,
    canRefreshWorkspace,
    onRefreshWorkspace,
  } = props
  const [email, setEmail] = useState(auth.lastEmail)
  const [password, setPassword] = useState('')
  const isBusy = auth.status === 'signing_in'
    || auth.status === 'signing_out'
    || auth.status === 'initializing'

  useEffect(() => {
    if (!email && auth.lastEmail) {
      setEmail(auth.lastEmail)
    }
  }, [auth.lastEmail, email])

  if (auth.status === 'signed_in') {
    return (
      <View style={styles.authCard}>
        <View style={styles.authHeader}>
          <View>
            <Text style={styles.authTitle}>账户</Text>
            <Text style={styles.authEmail}>{auth.user?.email ?? '已登录'}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{authStatusLabel(auth.status)}</Text>
          </View>
        </View>
        <View style={styles.authStatusRow}>
          <Metric label="Workspace" value={workspaceStatus} />
          <Metric label="API" value={apiConfigured ? '已配置' : '缺少'} />
        </View>
        {workspaceError ? (
          <Text style={styles.errorText}>{workspaceError}</Text>
        ) : null}
        <View style={styles.actionRow}>
          <TouchableOpacity
            disabled={!canRefreshWorkspace}
            onPress={onRefreshWorkspace}
            style={[
              styles.secondaryButton,
              !canRefreshWorkspace ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>同步</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isBusy}
            onPress={() => {
              void auth.signOut()
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>退出</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.authCard}>
      <View style={styles.authHeader}>
        <View>
          <Text style={styles.authTitle}>账户</Text>
          <Text style={styles.authEmail}>同步前需要登录</Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{authStatusLabel(auth.status)}</Text>
        </View>
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isBusy}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="邮箱"
        placeholderTextColor="#9b9085"
        style={styles.input}
        textContentType="emailAddress"
        value={email}
      />
      <TextInput
        editable={!isBusy}
        onChangeText={setPassword}
        placeholder="密码"
        placeholderTextColor="#9b9085"
        secureTextEntry
        style={styles.input}
        textContentType="password"
        value={password}
      />
      {auth.errorMessage ? (
        <Text style={styles.errorText}>{auth.errorMessage}</Text>
      ) : null}
      <TouchableOpacity
        disabled={isBusy || auth.status === 'config_missing'}
        onPress={() => {
          void auth.signInWithPassword({ email, password })
        }}
        style={[
          styles.primaryButton,
          isBusy || auth.status === 'config_missing'
            ? styles.buttonDisabled
            : null,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {auth.status === 'signing_in' ? '登录中' : '登录'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f3ec',
  },
  appShell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  header: {
    paddingVertical: 14,
  },
  kicker: {
    color: '#8a5a2b',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#211a14',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  subtitle: {
    color: '#6d6257',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e4d9cd',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
    padding: 14,
  },
  authHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  authTitle: {
    color: '#211a14',
    fontSize: 16,
    fontWeight: '800',
  },
  authEmail: {
    color: '#6d6257',
    fontSize: 13,
    marginTop: 3,
  },
  authStatusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: '#f7f3ec',
    borderColor: '#e4d9cd',
    borderRadius: 8,
    borderWidth: 1,
    color: '#211a14',
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  practiceInput: {
    backgroundColor: '#f7f3ec',
    borderColor: '#e4d9cd',
    borderRadius: 8,
    borderWidth: 1,
    color: '#211a14',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 78,
    padding: 12,
    textAlignVertical: 'top',
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderColor: '#e5ded4',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 6,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#211a14',
  },
  tabLabel: {
    color: '#5f554c',
    fontSize: 14,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    gap: 12,
    paddingVertical: 14,
  },
  surfacePanel: {
    backgroundColor: '#ffffff',
    borderColor: '#e3d8cb',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  surfaceHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  surfaceTitle: {
    color: '#211a14',
    flex: 1,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 28,
  },
  statusPill: {
    backgroundColor: '#f5eadb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: '#7a4c16',
    fontSize: 12,
    fontWeight: '700',
  },
  surfaceCopy: {
    color: '#63584f',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#d97706',
    borderRadius: 8,
    marginTop: 6,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#f5eadb',
    borderRadius: 8,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#5c3b16',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#e8dfd4',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: '#211a14',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionLead: {
    color: '#2b241e',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 8,
  },
  recorderPanel: {
    backgroundColor: '#fbf8f2',
    borderColor: '#eadfce',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    marginTop: 12,
    padding: 12,
  },
  inlineStatus: {
    color: '#7a4c16',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metric: {
    backgroundColor: '#f7f3ec',
    borderColor: '#eadfce',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    justifyContent: 'center',
    padding: 10,
  },
  metricValue: {
    color: '#211a14',
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#6c6258',
    fontSize: 12,
    marginTop: 4,
  },
  mutedText: {
    color: '#756a61',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  errorText: {
    color: '#b42318',
    fontSize: 13,
    lineHeight: 19,
  },
  successText: {
    color: '#157347',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  lineItem: {
    backgroundColor: '#f7f3ec',
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
  },
  lineText: {
    color: '#2b241e',
    fontSize: 15,
    lineHeight: 22,
  },
  deviceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  phraseWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phraseChip: {
    backgroundColor: '#f5eadb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  phraseText: {
    color: '#5c3b16',
    fontSize: 13,
    fontWeight: '700',
  },
})
