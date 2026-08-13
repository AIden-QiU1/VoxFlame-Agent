import { readFileSync } from 'node:fs'

const [jsonPath, field] = process.argv.slice(2)
const allowedFields = new Set([
  'appBuildVersion',
  'appVersion',
  'buildUrl',
  'completedAt',
  'createdAt',
  'expirationDate',
  'gitCommitHash',
  'id',
  'status',
])

if (!jsonPath || !allowedFields.has(field)) {
  throw new Error('usage: read-eas-android-build.mjs <json-path> <supported-field>')
}

const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'))
const build = Array.isArray(parsed) ? parsed[0] : parsed

if (!build || build.platform !== 'ANDROID') {
  throw new Error('EAS response does not contain an Android build')
}

const value = field === 'buildUrl' ? build.artifacts?.buildUrl : build[field]
if (value === undefined || value === null || value === '') {
  throw new Error(`Android build field is missing: ${field}`)
}

process.stdout.write(String(value))
