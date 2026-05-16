import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(testDir, '..')
const srcRoot = path.join(projectRoot, 'src')

function resolveCandidate(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ]

  return candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile()
    } catch {
      return false
    }
  }) ?? null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const candidate = resolveCandidate(path.join(srcRoot, specifier.slice(2)))
      if (candidate) {
        return {
          shortCircuit: true,
          url: pathToFileURL(candidate).href,
        }
      }
    }

    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !path.extname(specifier) &&
      context.parentURL?.startsWith('file:')
    ) {
      const parentPath = fileURLToPath(context.parentURL)
      const candidate = resolveCandidate(path.resolve(path.dirname(parentPath), specifier))
      if (candidate) {
        return {
          shortCircuit: true,
          url: pathToFileURL(candidate).href,
        }
      }
    }

    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      const json = fs.readFileSync(fileURLToPath(url), 'utf8')
      return {
        format: 'module',
        shortCircuit: true,
        source: `export default ${json};`,
      }
    }

    return nextLoad(url, context)
  },
})
