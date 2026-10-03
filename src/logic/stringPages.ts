// Static, indexable pages for every string (Google visibility).
//
// The app itself is a single-page app, and search engines can't index
// "#…" addresses. So at build time, every string also gets a real page at
// /smash_lab/strings/<id>/ — a copy of index.html with its own <title>,
// description, canonical URL and social tags, plus the string's content as
// plain HTML inside #root. Crawlers read that HTML directly; for visitors,
// the app boots and replaces it with the interactive page a moment later.
//
// Pure functions only (no fs, no DOM) so they can be unit-tested and called
// from the Vite build (vite.config.ts) alike.

import type { StringItem } from '../data/strings.js'
import type { StringSpecialistProfile } from '../data/stringSpecialistProfiles.js'

export const SITE_URL = 'https://thegrandnick.github.io/smash_lab/'

const CATEGORY_LABEL: Record<StringItem['category'], string> = {
  repulsion: 'Quick-repulsion string',
  control: 'Control string',
  durability: 'Durability string',
}

const RATING_LABELS: [keyof Pick<StringItem, 'repulsion' | 'control' | 'durability' | 'hittingSound' | 'shockAbsorption'>, string][] = [
  ['repulsion', 'Repulsion'],
  ['control', 'Control'],
  ['durability', 'Durability'],
  ['hittingSound', 'Hitting sound'],
  ['shockAbsorption', 'Shock absorption'],
]

/** Relative path of a string's page, e.g. "strings/yonex-bg80/". */
export function stringPagePath(id: string): string {
  return `strings/${encodeURIComponent(id)}/`
}

export function stringPageUrl(id: string): string {
  return SITE_URL + stringPagePath(id)
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function gaugeText(item: StringItem): string | undefined {
  if (item.isHybrid) {
    const main = item.mainString?.gauge
    const cross = item.crossString?.gauge
    if (main != null && cross != null) return `${main} / ${cross} mm hybrid`
    return 'hybrid'
  }
  return item.tension?.gauge != null ? `${item.tension.gauge} mm` : undefined
}

/** Cuts text at a sentence or word boundary, never mid-word, and never beyond `max` characters. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const sentenceEnd = cut.lastIndexOf('. ')
  if (sentenceEnd > max * 0.6) return cut.slice(0, sentenceEnd + 1)
  const wordEnd = cut.lastIndexOf(' ')
  return `${cut.slice(0, wordEnd > 0 ? wordEnd : cut.length).replace(/[,;:—-]+$/, '')}…`
}

export interface PageMeta {
  title: string
  description: string
  canonical: string
}

export function buildStringPageMeta(item: StringItem, profile: StringSpecialistProfile | undefined): PageMeta {
  const fullName = `${item.brand} ${item.name}`
  const gauge = gaugeText(item)
  const handsOn = profile ? ' with hands-on stringer notes' : ''
  const title = `${fullName} badminton string: specs, feel & review | Smash Lab`
  const lead = `${fullName}${gauge ? ` (${gauge})` : ''}: ${CATEGORY_LABEL[item.category].toLowerCase()}${handsOn}.`
  const description = truncate(item.notes ? `${lead} ${item.notes}` : `${lead} Compare its ratings with the full lineup or take the quiz.`, 155)
  return { title, description, canonical: stringPageUrl(item.id) }
}

function ratingsHtml(item: StringItem): string {
  const rows = RATING_LABELS.filter(([key]) => item[key] != null)
    .map(([key, label]) => `<div><dt>${label}</dt><dd>${item[key]} / 11</dd></div>`)
    .join('')
  return rows ? `<h2>Manufacturer ratings</h2><dl>${rows}</dl>` : ''
}

function listHtml(title: string, items: string[] | undefined): string {
  if (!items?.length) return ''
  return `<h3>${escapeHtml(title)}</h3><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
}

/**
 * Crawlable content for one string. Plain semantic HTML — the same facts the
 * interactive page shows, so what Google indexes matches what visitors see.
 */
export function renderStringPageBody(item: StringItem, profile: StringSpecialistProfile | undefined, all: StringItem[], base: string): string {
  const fullName = `${item.brand} ${item.name}`
  const gauge = gaugeText(item)
  const facts = [CATEGORY_LABEL[item.category], gauge].filter(Boolean)
  const handsOn = profile
    ? `<section><h2>Smash Lab hands-on notes</h2>${listHtml('Strengths', profile.strengths)}${listHtml('Trade-offs', profile.weaknesses)}${
        profile.subjectiveNotes ? `<p>${escapeHtml(profile.subjectiveNotes)}</p>` : ''
      }</section>`
    : ''
  const others = all
    .filter((s) => s.id !== item.id)
    .map((s) => `<li><a href="${base}${stringPagePath(s.id)}">${escapeHtml(`${s.brand} ${s.name}`)}</a></li>`)
    .join('')

  return [
    '<main class="static-page">',
    `<p><a href="${base}strings/">All badminton strings</a></p>`,
    `<h1>${escapeHtml(fullName)}</h1>`,
    `<p>${escapeHtml(facts.join(' · '))}</p>`,
    item.notes ? `<p>${escapeHtml(item.notes)}</p>` : '',
    ratingsHtml(item),
    handsOn,
    `<p><a href="${base}#finder">Not sure it suits you? Take the 60-second string quiz</a> or <a href="${base}#compare">compare it with other strings</a>.</p>`,
    `<nav aria-label="Other strings"><h2>Other strings</h2><ul>${others}</ul></nav>`,
    '</main>',
  ].join('')
}

export function buildStringsIndexMeta(): PageMeta {
  return {
    title: 'All badminton strings compared: Yonex, Li-Ning, Victor | Smash Lab',
    description: 'Every badminton string in the Smash Lab lineup with gauge, manufacturer ratings and hands-on stringer notes. Compare them side by side or take the quiz.',
    canonical: `${SITE_URL}strings/`,
  }
}

export function renderStringsIndexBody(all: StringItem[], base: string): string {
  const byBrand = new Map<string, StringItem[]>()
  for (const s of all) byBrand.set(s.brand, [...(byBrand.get(s.brand) ?? []), s])
  const sections = [...byBrand.entries()]
    .map(
      ([brand, items]) =>
        `<section><h2>${escapeHtml(brand)}</h2><ul>${items
          .map((s) => {
            const gauge = gaugeText(s)
            return `<li><a href="${base}${stringPagePath(s.id)}">${escapeHtml(`${s.brand} ${s.name}`)}</a>${gauge ? ` (${escapeHtml(gauge)})` : ''}</li>`
          })
          .join('')}</ul></section>`,
    )
    .join('')
  return `<main class="static-page"><h1>All badminton strings</h1><p><a href="${base}#finder">Take the 60-second quiz</a> to find the right one for your game.</p>${sections}</main>`
}

interface TemplateOptions {
  noindex?: boolean
}

/** Replaces one attribute value inside the first tag matching `tagPattern`; throws if the tag is missing, so a changed index.html fails the build loudly instead of shipping pages with the home page's metadata. */
function setTagAttr(html: string, tagPattern: RegExp, attr: string, value: string): string {
  const match = html.match(tagPattern)
  if (!match) throw new Error(`stringPages: tag not found in index.html: ${tagPattern}`)
  const tag = match[0]
  const updated = tag.replace(new RegExp(`${attr}="[^"]*"`), `${attr}="${escapeHtml(value)}"`)
  return html.replace(tag, updated)
}

/** Turns the built index.html into a page with its own metadata and pre-rendered content. */
export function applyPageToTemplate(template: string, meta: PageMeta, bodyHtml: string, options: TemplateOptions = {}): string {
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
  html = setTagAttr(html, /<meta name="description"[^>]*>/, 'content', meta.description)
  html = setTagAttr(html, /<link rel="canonical"[^>]*>/, 'href', meta.canonical)
  html = setTagAttr(html, /<meta property="og:title"[^>]*>/, 'content', meta.title)
  html = setTagAttr(html, /<meta property="og:description"[^>]*>/, 'content', meta.description)
  html = setTagAttr(html, /<meta property="og:url"[^>]*>/, 'content', meta.canonical)
  html = setTagAttr(html, /<meta name="twitter:title"[^>]*>/, 'content', meta.title)
  html = setTagAttr(html, /<meta name="twitter:description"[^>]*>/, 'content', meta.description)
  if (options.noindex) html = html.replace('</title>', '</title>\n    <meta name="robots" content="noindex" />')
  if (!html.includes('<div id="root"></div>')) throw new Error('stringPages: <div id="root"></div> not found in index.html')
  return html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`)
}

export function buildSitemap(urls: string[], lastmod: string): string {
  const entries = urls.map((u) => `  <url>\n    <loc>${escapeHtml(u)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}
