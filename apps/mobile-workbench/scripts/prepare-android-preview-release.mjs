import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..')
const latestFinishedBuildCode = Number.parseInt(process.argv[2] ?? '0', 10)

if (!Number.isInteger(latestFinishedBuildCode) || latestFinishedBuildCode < 0) {
  throw new Error('latest finished Android build code must be a non-negative integer')
}

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(appRoot, fileName), 'utf8'))
}

function writeJson(fileName, value) {
  writeFileSync(path.join(appRoot, fileName), `${JSON.stringify(value, null, 2)}\n`)
}

function incrementPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) {
    throw new Error(`mobile app version must use x.y.z format: ${version}`)
  }

  return `${match[1]}.${match[2]}.${Number.parseInt(match[3], 10) + 1}`
}

const packageJson = readJson('package.json')
const packageLock = readJson('package-lock.json')
const appJson = readJson('app.json')
const localBuildCode = appJson.expo?.android?.versionCode

if (!Number.isInteger(localBuildCode)) {
  throw new Error('expo.android.versionCode must be an integer')
}

if (localBuildCode > latestFinishedBuildCode) {
  console.log(`Android release version already prepared: ${packageJson.version} (${localBuildCode})`)
  process.exit(0)
}

const nextBuildCode = latestFinishedBuildCode + 1
const nextVersion = incrementPatch(packageJson.version)

packageJson.version = nextVersion
packageLock.version = nextVersion
packageLock.packages[''].version = nextVersion
appJson.expo.version = nextVersion
appJson.expo.android.versionCode = nextBuildCode
appJson.expo.ios.buildNumber = String(nextBuildCode)

writeJson('package.json', packageJson)
writeJson('package-lock.json', packageLock)
writeJson('app.json', appJson)

console.log(`Prepared Android release ${nextVersion} (${nextBuildCode})`)
