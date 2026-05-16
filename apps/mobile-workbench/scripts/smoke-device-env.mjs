import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')

const dotenvPath = path.join(appRoot, '.env')
const envFileValues = existsSync(dotenvPath) ? parseDotenv(readFileSync(dotenvPath, 'utf8')) : {}
const publicEnv = {
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? envFileValues.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? envFileValues.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? envFileValues.EXPO_PUBLIC_SUPABASE_ANON_KEY,
}

const failures = []
const warnings = []

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
    const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
    values[key] = value
  }

  return values
}

function requirePublicEnv(name) {
  if (!publicEnv[name]) {
    failures.push(`${name} is missing`)
  }
}

requirePublicEnv('EXPO_PUBLIC_API_BASE_URL')
requirePublicEnv('EXPO_PUBLIC_SUPABASE_URL')
requirePublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY')

const apiBaseUrl = publicEnv.EXPO_PUBLIC_API_BASE_URL ?? ''
if (apiBaseUrl.includes('127.0.0.1') || apiBaseUrl.includes('localhost')) {
  warnings.push('EXPO_PUBLIC_API_BASE_URL points at localhost. A physical phone cannot use your laptop localhost unless you use a tunnel.')
}

if (!apiBaseUrl.endsWith('/api')) {
  warnings.push('EXPO_PUBLIC_API_BASE_URL should usually end with /api for the current backend contract.')
}

const forbiddenSecretKeyParts = [
  ['SERVICE', 'ROLE'],
  ['LIVEKIT', 'API', 'SECRET'],
  ['DASHSCOPE', 'API', 'KEY'],
  ['OSS', 'ACCESS', 'KEY', 'SECRET'],
]

for (const [key, value] of Object.entries({ ...process.env, ...envFileValues })) {
  if (!value) {
    continue
  }

  const upperKey = key.toUpperCase()
  const hasForbiddenSecretKey = forbiddenSecretKeyParts.some((parts) => upperKey.includes(parts.join('_')))
  if (hasForbiddenSecretKey) {
    failures.push(`${key} must not be present in mobile app environment`)
  }
}

if (failures.length > 0) {
  console.error('mobile device env smoke failed')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('mobile device env smoke passed')
console.log(`api base: ${apiBaseUrl || '<missing>'}`)
console.log(`supabase url: ${publicEnv.EXPO_PUBLIC_SUPABASE_URL ? '<configured>' : '<missing>'}`)
console.log(`supabase anon key: ${publicEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '<configured>' : '<missing>'}`)

if (warnings.length > 0) {
  console.log('warnings:')
  for (const warning of warnings) {
    console.log(`- ${warning}`)
  }
}
