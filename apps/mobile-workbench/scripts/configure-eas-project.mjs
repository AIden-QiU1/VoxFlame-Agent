import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(appRoot, '../..')
const frontendEnvPath = path.join(repoRoot, 'frontend/.env.local')
const PUBLIC_API_BASE_URL = 'https://voxember.com/api'
const EAS_ENVIRONMENTS = ['development', 'preview', 'production']

function parseDotenv(text) {
  const values = {}

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    values[key] = value
  }

  return values
}

function fail(message) {
  console.error(`EAS 配置失败：${message}`)
  process.exit(1)
}

function runEas(args) {
  const env = { ...process.env }
  delete env.HTTP_PROXY
  delete env.HTTPS_PROXY
  delete env.NODE_TLS_REJECT_UNAUTHORIZED

  const result = spawnSync(
    'npx',
    ['--yes', 'eas-cli@latest', ...args],
    {
      cwd: appRoot,
      env,
      stdio: 'inherit',
    },
  )

  if (result.error) {
    fail(result.error.message)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const expoToken = process.env.EXPO_TOKEN?.trim() ?? ''
if (expoToken.length < 20) {
  fail('当前终端没有有效 EXPO_TOKEN。请先执行 read -s EXPO_TOKEN，然后 export EXPO_TOKEN。')
}

if (!existsSync(frontendEnvPath)) {
  fail('找不到 frontend/.env.local，无法复用 Supabase 公共配置。')
}

const frontendEnv = parseDotenv(readFileSync(frontendEnvPath, 'utf8'))
const supabaseUrl = (
  process.env.EXPO_PUBLIC_SUPABASE_URL
  || frontendEnv.NEXT_PUBLIC_SUPABASE_URL
  || ''
).trim()
const supabaseAnonKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || frontendEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || ''
).trim()

if (!supabaseUrl.startsWith('https://')) {
  fail('Supabase URL 缺失或不是 HTTPS。')
}

if (supabaseAnonKey.length < 20) {
  fail('Supabase anon key 缺失。')
}

console.log('1/3 验证 Expo 账户…')
runEas(['whoami'])

console.log('2/3 创建或绑定 qiuds-team/voxflame-mobile-workbench…')
runEas(['init', '--force', '--non-interactive'])

console.log('3/3 同步 App 公共运行配置…')
const publicVariables = {
  EXPO_PUBLIC_API_BASE_URL: PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  EXPO_PUBLIC_PHONE_AUTH_ENABLED: (
    process.env.EXPO_PUBLIC_PHONE_AUTH_ENABLED
    || frontendEnv.NEXT_PUBLIC_PHONE_AUTH_ENABLED
    || '0'
  ).trim(),
}

for (const [name, value] of Object.entries(publicVariables)) {
  runEas([
    'env:set',
    ...EAS_ENVIRONMENTS.flatMap((environment) => ['--environment', environment]),
    '--name',
    name,
    '--value',
    value,
    '--visibility',
    'plaintext',
    '--scope',
    'project',
    '--non-interactive',
  ])
}

console.log('EAS 项目与三套公共环境配置完成。')
console.log('下一步：npm run build:android:preview')
