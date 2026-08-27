import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const sourcePath = path.resolve('src/memory/mobile-hotword-editor.ts')
const source = await readFile(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'voxflame-mobile-memory-'))
const outputPath = path.join(outputDirectory, 'mobile-hotword-editor.mjs')
await writeFile(outputPath, transpiled)
const { removeMobileHotwordProfile, upsertMobileHotwordProfile } = await import(
  `${pathToFileURL(outputPath).href}?v=${Date.now()}`
)

const created = upsertMobileHotwordProfile([], {
  phrase: '  帕金森  ',
  category: 'medical',
  scenario: '复诊',
  note: '慢一点说',
}, 100)
assert.equal(created.length, 1)
assert.equal(created[0].phrase, '帕金森')
assert.equal(created[0].createdAt, 100)

const updated = upsertMobileHotwordProfile(created, {
  id: created[0].id,
  phrase: '帕金森病',
  category: 'medical',
  scenario: '就医',
}, 200)
assert.equal(updated.length, 1)
assert.equal(updated[0].phrase, '帕金森病')
assert.equal(updated[0].createdAt, 100)
assert.equal(updated[0].updatedAt, 200)
assert.deepEqual(removeMobileHotwordProfile(updated, updated[0].id), [])

console.log('mobile memory editor tests passed')
