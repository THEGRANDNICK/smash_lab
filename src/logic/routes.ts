// Which view a URL shows. Two kinds of addresses exist side by side:
// - hash views on the root page (…/smash_lab/#finder, #compare, …) — the app's normal navigation;
// - real paths for string pages (…/smash_lab/strings/<id>/ and …/strings/), which are static,
//   indexable HTML files that the app takes over once it loads.
// Pure functions, so the rules can be unit-tested without a browser.

export type PathRoute = { kind: 'root' } | { kind: 'string'; id: string } | { kind: 'stringsIndex' } | { kind: 'notFound' }

export function routeFromPath(pathname: string, base: string): PathRoute {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  if (pathname === normalizedBase || pathname === normalizedBase.slice(0, -1) || pathname === `${normalizedBase}index.html`) return { kind: 'root' }
  if (!pathname.startsWith(normalizedBase)) return { kind: 'notFound' }
  const rest = pathname.slice(normalizedBase.length).replace(/index\.html$/, '')
  if (rest === 'strings' || rest === 'strings/') return { kind: 'stringsIndex' }
  const match = rest.match(/^strings\/([^/]+)\/?$/)
  if (match) {
    try {
      return { kind: 'string', id: decodeURIComponent(match[1]) }
    } catch {
      return { kind: 'notFound' }
    }
  }
  return { kind: 'notFound' }
}

/** Old shareable links from before real string pages existed: "#string/<id>". */
export function legacyStringIdFromHash(hash: string): string | undefined {
  const clean = hash.replace(/^#/, '')
  if (!clean.startsWith('string/')) return undefined
  try {
    return decodeURIComponent(clean.slice('string/'.length)) || undefined
  } catch {
    return undefined
  }
}
