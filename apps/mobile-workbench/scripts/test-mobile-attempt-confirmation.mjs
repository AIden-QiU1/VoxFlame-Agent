import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const sourcePath = path.resolve('src/training/mobile-attempt-confirmation.ts')
const source = await readFile(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'voxflame-mobile-confirmation-'))
const outputPath = path.join(outputDirectory, 'mobile-attempt-confirmation.mjs')
await writeFile(outputPath, transpiled)
const {
  confirmMobileTrainingAttempt,
  discardMobileTrainingAttempt,
  replaceMobileTrainingAttempt,
} = await import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`)

assert.equal(await confirmMobileTrainingAttempt(async () => ({ recordingId: 'one' })), 'confirmed')
assert.equal(await confirmMobileTrainingAttempt(async () => null), 'kept')
assert.equal(await discardMobileTrainingAttempt(async () => true), 'discarded')
assert.equal(await discardMobileTrainingAttempt(async () => false), 'kept')

const successfulOrder = []
assert.equal(
  await replaceMobileTrainingAttempt(
    async () => {
      successfulOrder.push('discard')
      return true
    },
    async () => {
      successfulOrder.push('start')
      return true
    },
  ),
  'replacement_started',
)
assert.deepEqual(successfulOrder, ['discard', 'start'])

let startedAfterFailedDiscard = false
assert.equal(
  await replaceMobileTrainingAttempt(
    async () => false,
    async () => {
      startedAfterFailedDiscard = true
      return true
    },
  ),
  'discard_failed',
)
assert.equal(startedAfterFailedDiscard, false)

assert.equal(
  await replaceMobileTrainingAttempt(async () => true, async () => false),
  'start_failed',
)

console.log('mobile attempt confirmation tests passed')
