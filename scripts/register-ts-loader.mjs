import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !specifier.endsWith('.ts') &&
      !specifier.endsWith('.tsx') &&
      !specifier.endsWith('.js') &&
      !specifier.endsWith('.mjs') &&
      context.parentURL
    ) {
      const parentPath = fileURLToPath(new URL('.', context.parentURL))
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        const candidateUrl = new URL(specifier + ext, pathToFileURL(parentPath + '/'))
        if (existsSync(fileURLToPath(candidateUrl))) {
          return nextResolve(candidateUrl.href, context)
        }
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.tsx')) {
      const raw = readFileSync(fileURLToPath(url), 'utf8')
      return {
        format: 'module-typescript',
        shortCircuit: true,
        source: raw,
      }
    }
    const result = nextLoad(url, context)
    if (
      url.endsWith('.ts') &&
      typeof result.source === 'string' &&
      result.source.includes('import.meta.env')
    ) {
      return {
        ...result,
        source:
          'if (!import.meta.env) { Object.defineProperty(import.meta, "env", { value: { DEV: false }, configurable: true }); }\n' +
          result.source,
      }
    }
    return result
  },
})
