import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(appRoot, '../..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(appRoot, relativePath), 'utf8'))
}

function walkFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.expo') {
      continue
    }

    const absolute = path.join(dir, entry)
    const stat = statSync(absolute)
    if (stat.isDirectory()) {
      files.push(...walkFiles(absolute))
      continue
    }

    files.push(absolute)
  }

  return files
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const packageJson = readJson('package.json')
const appJson = readJson('app.json')
const sourceFiles = walkFiles(appRoot).filter((file) => (
  file.endsWith('.ts')
  || file.endsWith('.tsx')
  || file.endsWith('.json')
  || file.endsWith('.md')
))
const sourceText = sourceFiles
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

assert(packageJson.name === '@voxflame/mobile-workbench', 'package name must stay scoped to mobile workbench')
assert(packageJson.scripts?.check === 'node scripts/check-mobile-workbench.mjs', 'mobile check script is missing')
assert(appJson.expo?.slug === 'voxflame-mobile-workbench', 'expo slug must be stable')
assert(appJson.expo?.extra?.rtcSurface === 'mobile_workbench', 'expo extra.rtcSurface must be mobile_workbench')

const plugins = JSON.stringify(appJson.expo?.plugins ?? [])
assert(plugins.includes('@livekit/react-native-expo-plugin'), 'LiveKit Expo plugin must be configured')
assert(plugins.includes('@config-plugins/react-native-webrtc'), 'react-native-webrtc config plugin must be configured')

const androidPermissions = appJson.expo?.android?.permissions ?? []
assert(androidPermissions.includes('android.permission.RECORD_AUDIO'), 'Android RECORD_AUDIO permission is required')
assert(androidPermissions.includes('android.permission.MODIFY_AUDIO_SETTINGS'), 'Android audio settings permission is required')

for (const surface of ['communication', 'practice', 'memory', 'device']) {
  assert(sourceText.includes(`'${surface}'`), `missing mobile surface: ${surface}`)
}

for (const forbidden of [
  `mobile_${'companion'}`,
  'LIVEKIT_API_SECRET',
  'SUPABASE_SERVICE_ROLE',
  'DASHSCOPE_API_KEY',
]) {
  assert(!sourceText.includes(forbidden), `forbidden token found: ${forbidden}`)
}

assert(
  existsSync(path.join(repoRoot, 'backend/src/controllers/rtc.controller.ts')),
  'repo root detection failed',
)

console.log('mobile workbench check passed')
