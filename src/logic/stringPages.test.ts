import { describe, it, expect } from 'vitest'
import template from '../../index.html?raw'
import { strings } from '../data/strings'
import { STRING_SPECIALIST_PROFILES } from '../data/stringSpecialistProfiles'
import {
  SITE_URL,
  applyPageToTemplate,
  buildSitemap,
  buildStringPageMeta,
  escapeHtml,
  renderStringPageBody,
  renderStringsIndexBody,
  stringPagePath,
  truncate,
} from './stringPages'

const BASE = '/smash_lab/'

describe('string page metadata', () => {
  it('gives every string a unique title, canonical URL and a description within Google’s snippet length', () => {
    const titles = new Set<string>()
    const urls = new Set<string>()
    for (const item of strings) {
      const meta = buildStringPageMeta(item, STRING_SPECIALIST_PROFILES[item.id])
      titles.add(meta.title)
      urls.add(meta.canonical)
      expect(meta.title).toContain(item.name)
      expect(meta.canonical).toBe(`${SITE_URL}strings/${item.id}/`)
      expect(meta.description.length).toBeLessThanOrEqual(155)
      expect(meta.description.length).toBeGreaterThan(40)
    }
    expect(titles.size).toBe(strings.length)
    expect(urls.size).toBe(strings.length)
  })

  it('truncates at word boundaries, never mid-word', () => {
    const t = truncate('alpha beta gamma delta epsilon zeta eta theta', 20)
    expect(t.length).toBeLessThanOrEqual(20)
    expect(t.endsWith('…')).toBe(true)
    expect('alpha beta gamma delta epsilon zeta eta theta'.startsWith(t.slice(0, -1))).toBe(true)
  })
})

describe('applying a page to the real index.html', () => {
  const item = strings.find((s) => s.id === 'yonex-bg80')!
  const meta = buildStringPageMeta(item, STRING_SPECIALIST_PROFILES[item.id])
  const html = applyPageToTemplate(template, meta, renderStringPageBody(item, STRING_SPECIALIST_PROFILES[item.id], strings, BASE))

  it('replaces title, description, canonical and social tags — none still point at the home page', () => {
    expect(html).toContain(`<title>${escapeHtml(meta.title)}</title>`)
    expect(html).toContain(`<link rel="canonical" href="${meta.canonical}"`)
    expect(html).toContain(`<meta property="og:url" content="${meta.canonical}"`)
    expect(html).not.toMatch(/<link rel="canonical" href="https:\/\/thegrandnick\.github\.io\/smash_lab\/"/)
    expect(html.match(/<title>/g)).toHaveLength(1)
  })

  it('puts real, crawlable content into #root, including the hands-on notes', () => {
    expect(html).toContain('<div id="root"><main class="static-page">')
    expect(html).toContain('<h1>Yonex BG80</h1>')
    expect(html).toContain('Smash Lab hands-on notes')
    expect(html).toContain(`href="${BASE}${stringPagePath('yonex-exbolt-65')}"`) // internal links for crawlers
  })

  it('adds no new inline script (the CSP only allows the existing JSON-LD hash)', () => {
    expect(html.match(/<script(?![^>]*src=)/g)?.length).toBe(template.match(/<script(?![^>]*src=)/g)?.length)
  })

  it('can mark a page noindex (used for 404.html)', () => {
    expect(applyPageToTemplate(template, meta, '', { noindex: true })).toContain('<meta name="robots" content="noindex" />')
  })

  it('fails loudly if index.html loses a tag it relies on', () => {
    expect(() => applyPageToTemplate(template.replace(/<link rel="canonical"[^>]*>/, ''), meta, '')).toThrow(/canonical/)
  })
})

describe('escaping and the overview', () => {
  it('escapes HTML in names and notes', () => {
    const evil = { ...strings[0], id: 'x', name: '<script>alert(1)</script>', notes: 'a & b "c"' }
    const body = renderStringPageBody(evil, undefined, [evil], BASE)
    expect(body).not.toContain('<script>')
    expect(body).toContain('&lt;script&gt;')
    expect(body).toContain('a &amp; b &quot;c&quot;')
  })

  it('links every string from the overview page', () => {
    const body = renderStringsIndexBody(strings, BASE)
    for (const s of strings) expect(body).toContain(`${BASE}${stringPagePath(s.id)}`)
  })

  it('builds a valid sitemap entry per URL', () => {
    const xml = buildSitemap([SITE_URL, `${SITE_URL}strings/a/`], '2026-09-27')
    expect(xml.match(/<url>/g)).toHaveLength(2)
    expect(xml).toContain('<lastmod>2026-09-27</lastmod>')
  })
})
