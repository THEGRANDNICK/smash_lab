import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
    plugins: [react(), tailwindcss()],
    base: '/smash_lab/',
    define: {
        'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
    },
})
