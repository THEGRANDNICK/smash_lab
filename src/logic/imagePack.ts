// Validation and planning for the string-image pack (smash_lab_string_images_*.zip).
//
// Pure functions: no zip, no browser, no Supabase — so every rule (exact id matching, safe file
// names, hash checks, "identical re-import is a no-op") is unit-testable. The admin page does the
// I/O and calls these.

export type ImageSide = 'front' | 'back'

export interface PackString {
  baseName: string
  front: string | null
  back: string | null
  notes: string[]
}

export interface PackAsset {
  stringId: string
  side: ImageSide
  file: string
  sha256: string
  sourcePage?: string
  rightsStatus?: string
}

export interface ImagePackManifest {
  packId: string
  strings: Record<string, PackString>
  assets: PackAsset[]
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

/** Flat file names only — no folders, no "..", only the documented pattern (e.g. BG80_f.jpg, LiNingNo1Boost_b.png). */
const SAFE_IMAGE_NAME = /^[A-Za-z0-9]+_[fb]\.(jpg|jpeg|png)$/
const SHA256_HEX = /^[0-9a-f]{64}$/

export function isSafeImageName(name: string): boolean {
  return SAFE_IMAGE_NAME.test(name)
}

export function parseImagePackManifest(raw: unknown): ParseResult<ImagePackManifest> {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['image_manifest.json is not a JSON object.'] }
  const m = raw as Record<string, unknown>
  if (m.packType !== 'smash-lab-string-images') errors.push(`Unexpected packType "${String(m.packType)}" — expected "smash-lab-string-images".`)
  if (typeof m.schemaVersion !== 'string' || !m.schemaVersion.startsWith('1.')) errors.push(`Unsupported schemaVersion "${String(m.schemaVersion)}" — this importer reads version 1.x.`)
  if (!m.strings || typeof m.strings !== 'object' || Array.isArray(m.strings)) errors.push('"strings" must be an object keyed by string id.')
  if (!Array.isArray(m.assets)) errors.push('"assets" must be a list.')
  if (errors.length) return { ok: false, errors }

  const strings: Record<string, PackString> = {}
  for (const [id, entry] of Object.entries(m.strings as Record<string, unknown>)) {
    const e = entry as Record<string, unknown>
    const front = e.front == null ? null : String(e.front)
    const back = e.back == null ? null : String(e.back)
    for (const [side, file, suffix] of [['front', front, '_f.'], ['back', back, '_b.']] as const) {
      if (file == null) continue
      if (!isSafeImageName(file)) errors.push(`${id}: unsafe or unexpected ${side} file name "${file}".`)
      else if (!file.includes(suffix)) errors.push(`${id}: ${side} file "${file}" doesn't end in ${suffix}jpg/png.`)
    }
    strings[id] = { baseName: String(e.baseName ?? id), front, back, notes: Array.isArray(e.notes) ? e.notes.map(String) : [] }
  }

  const assets: PackAsset[] = []
  for (const a of m.assets as Record<string, unknown>[]) {
    const side = a.side
    if (side !== 'front' && side !== 'back') {
      errors.push(`Asset ${String(a.file)}: side must be "front" or "back".`)
      continue
    }
    if (typeof a.sha256 !== 'string' || !SHA256_HEX.test(a.sha256)) errors.push(`Asset ${String(a.file)}: missing or malformed sha256.`)
    if (typeof a.file !== 'string' || !isSafeImageName(a.file)) errors.push(`Asset "${String(a.file)}": unsafe or unexpected file name.`)
    assets.push({
      stringId: String(a.stringId),
      side,
      file: String(a.file),
      sha256: String(a.sha256),
      sourcePage: typeof a.sourcePage === 'string' ? a.sourcePage : undefined,
      rightsStatus: typeof a.rightsStatus === 'string' ? a.rightsStatus : undefined,
    })
  }
  for (const [id, s] of Object.entries(strings)) {
    for (const side of ['front', 'back'] as const) {
      const file = s[side]
      if (file && !assets.some((a) => a.stringId === id && a.side === side && a.file === file)) errors.push(`${id}: ${side} file "${file}" has no asset record (hash/source).`)
    }
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { packId: `smash-lab-string-images-${String(m.generatedAt ?? 'unknown')}`, strings, assets } }
}

export type SideStatus = 'new' | 'changed' | 'unchanged' | 'not-in-pack' | 'file-missing' | 'hash-mismatch'

export interface PlannedSide {
  side: ImageSide
  status: SideStatus
  file?: string
  sha256?: string
  sourcePage?: string
}

export interface PlannedString {
  stringId: string
  /** False when the id isn't in the catalog — never imported, shown for review. */
  known: boolean
  front: PlannedSide
  back: PlannedSide
  notes: string[]
  /** Whether anything would actually change (default selection in the preview). */
  hasChanges: boolean
}

export interface ExistingImageState {
  frontSha?: string
  backSha?: string
}

/**
 * What an import would do, per string and side. `actualHashes` are the SHA-256 values computed
 * from the real file bytes; a file whose bytes don't match its manifest hash is never imported.
 */
export function planImageImport(
  manifest: ImagePackManifest,
  catalogIds: Set<string>,
  existing: Record<string, ExistingImageState>,
  actualHashes: Record<string, string>,
): PlannedString[] {
  return Object.entries(manifest.strings)
    .map(([stringId, entry]) => {
      const planSide = (side: ImageSide): PlannedSide => {
        const file = entry[side]
        if (!file) return { side, status: 'not-in-pack' }
        const asset = manifest.assets.find((a) => a.stringId === stringId && a.side === side && a.file === file)
        const actual = actualHashes[file]
        if (actual == null) return { side, status: 'file-missing', file }
        if (!asset || asset.sha256 !== actual) return { side, status: 'hash-mismatch', file, sha256: actual }
        const current = side === 'front' ? existing[stringId]?.frontSha : existing[stringId]?.backSha
        const status: SideStatus = current == null ? 'new' : current === actual ? 'unchanged' : 'changed'
        return { side, status, file, sha256: actual, sourcePage: asset.sourcePage }
      }
      const front = planSide('front')
      const back = planSide('back')
      const known = catalogIds.has(stringId)
      const hasChanges = known && [front, back].some((s) => s.status === 'new' || s.status === 'changed')
      return { stringId, known, front, back, notes: entry.notes, hasChanges }
    })
    .sort((a, b) => a.stringId.localeCompare(b.stringId))
}

/** Content-addressed storage path: a changed image gets a new URL, so browsers never show a stale cached one. */
export function storagePath(stringId: string, side: ImageSide, sha256: string, extension: string): string {
  return `${stringId}/${side}-${sha256.slice(0, 12)}.${extension}`
}

/** JPEG or PNG by magic bytes — the extension alone is never trusted. */
export function sniffImageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length > 7 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  return null
}

/** Target size for display: long side at most `max` px, never upscaled. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
