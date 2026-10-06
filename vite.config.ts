import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin, ResolvedConfig } from 'vite'
import { strings } from './src/data/strings.js'
import {
  SITE_URL,
  applyPageToTemplate,
  buildSitemap,
  buildStringPageMeta,
  buildStringsIndexMeta,
  renderStringPageBody,
  renderStringsIndexBody,
  stringPagePath,
  stringPageUrl,
} from './src/logic/stringPages.js'

/**
 * Google visibility: after every production build, write one real HTML page
 * per string (dist/strings/<id>/index.html), an overview page
 * (dist/strings/index.html), a sitemap listing all of them, and a 404.html
 * so unknown paths on GitHub Pages still load the app. The page content comes
 * from the string data in this repo (src/data/strings.ts and the specialist
 * profiles) — a string added only in the admin shows up in the app as usual,
 * but only gets its own indexable page once it's also in strings.ts.
 */
function stringPagesPlugin(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'smash-lab-string-pages',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    closeBundle() {
      const outDir = resolve(config.root, config.build.outDir)
      const base = config.base
      const template = readFileSync(join(outDir, 'index.html'), 'utf-8')
      const write = (relPath: string, content: string) => {
        const file = join(outDir, relPath)
        mkdirSync(join(file, '..'), { recursive: true })
        writeFileSync(file, content)
      }

      for (const item of strings) {
        // No hands-on notes in the prebuilt pages: they come only LIVE from the database (rendered by
        // the app), so deleting them there removes them everywhere — Google's copy included.
        const profile = undefined
        const html = applyPageToTemplate(template, buildStringPageMeta(item, profile), renderStringPageBody(item, profile, strings, base))
        write(join(stringPagePath(item.id), 'index.html'), html)
      }
      write(join('strings', 'index.html'), applyPageToTemplate(template, buildStringsIndexMeta(), renderStringsIndexBody(strings, base)))

      // GitHub Pages serves 404.html for any unknown path: load the app (which shows its own
      // "page not found" view) but keep the page itself out of search results.
      write(
        '404.html',
        applyPageToTemplate(
          template,
          { title: 'Page not found | Smash Lab', description: 'This page does not exist on Smash Lab.', canonical: SITE_URL },
          '',
          { noindex: true },
        ),
      )

      const today = new Date().toISOString().slice(0, 10)
      write('sitemap.xml', buildSitemap([SITE_URL, `${SITE_URL}strings/`, ...strings.map((s) => stringPageUrl(s.id))], today))
      config.logger.info(`\n  string pages: ${strings.length} + overview + sitemap + 404 written to ${config.build.outDir}/`)
    },
  }
}

// Phase 9: package.json's own "version" field is the single source of
// truth for the admin footer's version display (see src/logic/version.ts)
// — read once here at build time and injected as a statically-replaced
// import.meta.env value, exactly the way VITE_SUPABASE_URL/ANON_KEY
// already work (see src/lib/supabase.ts). Never a secret: this is the
// same public version string already committed in package.json, nothing
// from the environment or a deployment secret.
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), stringPagesPlugin()],
    base: '/smash_lab/',
    define: {
        'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
    },
})
