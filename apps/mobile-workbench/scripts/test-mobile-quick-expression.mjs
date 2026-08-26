import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const sourcePath = path.resolve('src/communication/quick-expression.ts')
const source = await readFile(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'voxflame-mobile-quick-expression-'))
const outputPath = path.join(outputDirectory, 'quick-expression.mjs')
await writeFile(outputPath, transpiled)
const {
  MOBILE_QUICK_EXPRESSION_PHRASES,
  buildMobileQuickExpressionPhrases,
} = await import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`)

assert.equal(MOBILE_QUICK_EXPRESSION_PHRASES.length, 6)
assert.deepEqual(
  buildMobileQuickExpressionPhrases(['  请给我一点时间。  ', '是的。', '', '请给我一点时间。'])
    .map((phrase) => phrase.text),
  [
    '是的。',
    '不是。',
    '请再说一遍。',
    '如果你没听清，请写给我看。',
    '请一个问题一个问题问我。',
    '请慢一点，我需要一点时间。',
    '请给我一点时间。',
  ],
)

console.log('mobile quick expression tests passed')
