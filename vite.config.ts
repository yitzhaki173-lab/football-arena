import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? listFiles(p) : [p]
  })
}

/**
 * Writes dist/precache.json with every file the app needs, and stamps the service worker
 * with a hash of them all, so a new build replaces the offline copy in one go.
 */
function precache(): Plugin {
  let outDir = 'dist'
  return {
    name: 'precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const skip = new Set(['sw.js', 'precache.json', '404.html'])
      const files = listFiles(outDir)
        .map((p) => relative(outDir, p).split('\\').join('/'))
        .filter((f) => !skip.has(f) && !f.startsWith('.'))
        // fonts: only the woff2 files for the scripts the app shows (browsers that load the rest are online)
        .filter((f) => !/\.(woff|ttf)$/.test(f) && !(/rubik-/.test(f) && !/rubik-(hebrew|latin)-\d/.test(f)))
        .sort()
      const hash = createHash('sha1')
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)))
      const version = hash.digest('hex').slice(0, 10)
      writeFileSync(join(outDir, 'precache.json'), JSON.stringify({ version, files }))
      const sw = join(outDir, 'sw.js')
      writeFileSync(sw, readFileSync(sw, 'utf8').replace('__VERSION__', version))
    },
  }
}

// base './' so the same build works on GitHub Pages (sub-path) and in a preview.
export default defineConfig({
  base: './',
  plugins: [react(), precache()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
})
