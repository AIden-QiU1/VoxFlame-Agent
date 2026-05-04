import React, { useMemo, useState } from 'react'
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import {
  MOBILE_WORKBENCH_SURFACES,
  type MobileWorkbenchSurfaceId,
} from './src/constants/surfaces'
import { buildMobileWorkbenchRtcSessionIntent } from './src/realtime/rtc-session-intent'
import { summarizeRecorderQueue } from './src/queue/recorder-queue-policy'

const PREPARED_LINES = [
  '请等我说完，我会用手机把重点给你看。',
  '我今天主要想确认检查结果和下一步安排。',
  '如果听不清，请让我慢一点重复。',
]

const QUICK_PHRASES = [
  '请看这句话',
  '我需要一点时间',
  '请不要替我回答',
  '我想重新说一遍',
]

function statusLabel(status: string): string {
  if (status === 'requires_backend') {
    return '等 backend token'
  }

  if (status === 'native_boundary') {
    return '等真机录音'
  }

  if (status === 'ready_for_contract') {
    return '可接 workspace'
  }

  return '已预留'
}

export default function App() {
  const [activeSurfaceId, setActiveSurfaceId] =
    useState<MobileWorkbenchSurfaceId>('communication')
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
  const queueSummary = useMemo(() => summarizeRecorderQueue([]), [])

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" />
      <View style={styles.appShell}>
        <View style={styles.header}>
          <Text style={styles.kicker}>VoxFlame</Text>
          <Text style={styles.title}>移动端工作台</Text>
          <Text style={styles.subtitle}>
            沟通、练习、准备和设备同步，使用同一套 backend contract。
          </Text>
        </View>

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
            <Text style={styles.acceptanceText}>
              {activeSurface.acceptanceSignal}
            </Text>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {activeSurface.primaryAction}
              </Text>
            </TouchableOpacity>
          </View>

          {activeSurfaceId === 'communication' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Talk Intent</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeLine}>surface: {rtcIntent.surface}</Text>
                <Text style={styles.codeLine}>mode: {rtcIntent.mode}</Text>
                <Text style={styles.codeLine}>
                  strategy: {rtcIntent.sessionStrategy}
                </Text>
              </View>
            </View>
          ) : null}

          {activeSurfaceId === 'practice' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recorder Queue</Text>
              <View style={styles.metricRow}>
                <Metric label="本地" value={queueSummary.localOnly} />
                <Metric label="待传" value={queueSummary.uploadPending} />
                <Metric label="失败" value={queueSummary.failed} />
              </View>
              <Text style={styles.mutedText}>{queueSummary.nextAction}</Text>
            </View>
          ) : null}

          {activeSurfaceId === 'memory' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>准备材料</Text>
              {PREPARED_LINES.map((line) => (
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
                <Metric label="麦克风" value="待授权" />
                <Metric label="补传" value="0" />
              </View>
              <Text style={styles.mutedText}>
                BLE / USB / 外接麦事件只进入显式映射层。
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>快捷短句</Text>
            <View style={styles.phraseWrap}>
              {QUICK_PHRASES.map((phrase) => (
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
  acceptanceText: {
    color: '#63584f',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#d97706',
    borderRadius: 8,
    marginTop: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  section: {
    backgroundColor: '#ffffff',
    borderColor: '#e8dfd4',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  sectionTitle: {
    color: '#211a14',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  codeBox: {
    backgroundColor: '#211a14',
    borderRadius: 8,
    padding: 12,
  },
  codeLine: {
    color: '#f5eadb',
    fontSize: 13,
    lineHeight: 22,
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
    fontSize: 18,
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
