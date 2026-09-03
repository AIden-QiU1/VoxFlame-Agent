import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const sourcePath = path.resolve('src/training/collection-protocol.ts')
const source = await readFile(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'voxflame-mobile-collection-controls-'))
const outputPath = path.join(outputDirectory, 'collection-protocol.mjs')
await writeFile(outputPath, transpiled)
const { getMobileCollectionControlState } = await import(
  `${pathToFileURL(outputPath).href}?v=${Date.now()}`
)

const incomplete = getMobileCollectionControlState({
  environmentReady: true,
  distanceReady: false,
  understandsConsent: true,
}, '开始说这句话')
assert.deepEqual(incomplete, {
  actionLabel: '先完成上方确认',
  navigationDisabled: true,
  ready: false,
})

const ready = getMobileCollectionControlState({
  environmentReady: true,
  distanceReady: true,
  understandsConsent: true,
}, '开始说这句话')
assert.deepEqual(ready, {
  actionLabel: '开始说这句话',
  navigationDisabled: false,
  ready: true,
})

console.log('mobile collection control tests passed')
