// I/O for the two admin importers (Admin → Imports). All decisions (what is valid, what changes,
// what gets merged) live in the pure modules logic/imagePack.ts and logic/researchPack.ts; this
// file only reads zips, hashes and resizes images, and talks to Supabase.

import { unzip } from 'fflate'
import { getSupabaseClient } from '../lib/supabase.js'
import type { Confidence, ExperienceSource, SpecialistDimensionKey, SpecialistFeel } from '../data/stringSpecialistProfiles.js'
import type { StringImageMetaJson } from '../types/database.js'
import { fitWithin, sniffImageType, storagePath, type ImageSide } from '../logic/imagePack.js'
import type { ExistingProfile } from '../logic/researchPack.js'
import { stringItemToInsert } from '../logic/catalogSync.js'
import type { StringItem } from '../data/strings.js'

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string }

const BUCKET = 'string-images'
const MAX_ZIP_BYTES = 80 * 1024 * 1024
const MAX_ENTRY_BYTES = 15 * 1024 * 1024
/** Long side of stored images. Plenty for a card or a detail page, a fraction of the original size. */
export const IMAGE_MAX_SIDE = 900

const wrap = async <T>(fn: () => Promise<T>): Promise<AdminResult<T>> => {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Reads a zip in the browser. Only flat entries (no folders) are returned; anything with a path,
 * and anything too large, is skipped — so a malicious zip can't smuggle in nested or huge files.
 */
export async function readZip(file: File): Promise<Record<string, Uint8Array>> {
  if (file.size > MAX_ZIP_BYTES) throw new Error(`The zip is ${(file.size / 1024 / 1024).toFixed(0)} MB — the limit is ${MAX_ZIP_BYTES / 1024 / 1024} MB.`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(
      bytes,
      { filter: (f) => !f.name.includes('/') && !f.name.includes('\\') && !f.name.includes('..') && f.originalSize <= MAX_ENTRY_BYTES },
      (err, data) => (err ? reject(err) : resolve(data)),
    ),
  )
  // Some zips wrap everything in one folder: if nothing is at the root, read that folder's files instead.
  if (Object.keys(entries).length > 0) return entries
  const nested = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(bytes, { filter: (f) => f.name.split('/').length === 2 && !f.name.includes('..') && f.originalSize <= MAX_ENTRY_BYTES }, (err, data) => (err ? reject(err) : resolve(data))),
  )
  return Object.fromEntries(Object.entries(nested).map(([name, data]) => [name.split('/')[1], data]).filter(([name]) => name !== ''))
}

export function readJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes))
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Decodes the real image (never trusting the extension), scales it down to IMAGE_MAX_SIDE and
 * re-encodes it as WebP (JPEG on browsers that can't encode WebP). Transparency is kept for WebP,
 * and filled white for the JPEG fallback so packets don't end up on black.
 */
export async function prepareImage(bytes: Uint8Array): Promise<{ blob: Blob; extension: string; width: number; height: number }> {
  const type = sniffImageType(bytes)
  if (!type) throw new Error('Not a real JPEG or PNG file.')
  const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type }))
  const { width, height } = fitWithin(bitmap.width, bitmap.height, IMAGE_MAX_SIDE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process images.')
  const toBlob = (mime: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality))

  ctx.drawImage(bitmap, 0, 0, width, height)
  const webp = await toBlob('image/webp', 0.85)
  if (webp && webp.type === 'image/webp') return { blob: webp, extension: 'webp', width, height }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  const jpeg = await toBlob('image/jpeg', 0.88)
  if (!jpeg) throw new Error('Could not encode the image.')
  return { blob: jpeg, extension: 'jpg', width, height }
}

export interface CatalogImageState {
  id: string
  imageUrl: string | null
  imageBackUrl: string | null
  meta: StringImageMetaJson | null
}

/** Every catalog string with its current images — the importer only ever writes to these ids. */
export function fetchCatalogImageState(): Promise<AdminResult<CatalogImageState[]>> {
  return wrap(async () => {
    const { data, error } = await getSupabaseClient().from('strings').select('*')
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({
      id: row.id,
      imageUrl: row.image_url ?? null,
      imageBackUrl: row.image_back_url ?? null,
      meta: (row.image_meta as StringImageMetaJson | null | undefined) ?? null,
    }))
  })
}

/** Uploads one prepared image under a content-addressed path and returns its public URL. */
export function uploadStringImage(stringId: string, side: ImageSide, sha256: string, image: { blob: Blob; extension: string }): Promise<AdminResult<string>> {
  return wrap(async () => {
    const path = storagePath(stringId, side, sha256, image.extension)
    const storage = getSupabaseClient().storage.from(BUCKET)
    const { error } = await storage.upload(path, image.blob, { upsert: true, contentType: image.blob.type, cacheControl: '31536000' })
    if (error) throw new Error(error.message)
    return storage.getPublicUrl(path).data.publicUrl
  })
}

/** Points a catalog string at its new images. Fails clearly if the string isn't in the database. */
export function saveStringImages(stringId: string, update: { image_url?: string; image_back_url?: string; image_meta: StringImageMetaJson }): Promise<AdminResult<void>> {
  return wrap(async () => {
    const { data, error } = await getSupabaseClient().from('strings').update(update).eq('id', stringId).select('id')
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) throw new Error(`"${stringId}" is not in the database catalog (add it in Catalog first).`)
  })
}

/** Current specialist profiles in the database, in the shape the research merge needs. */
export function fetchExistingProfiles(): Promise<AdminResult<Record<string, ExistingProfile>>> {
  return wrap(async () => {
    const { data, error } = await getSupabaseClient().from('specialist_profiles').select('*')
    if (error) throw new Error(error.message)
    const out: Record<string, ExistingProfile> = {}
    for (const row of data ?? []) {
      out[row.string_id] = {
        experienceSource: row.experience_source as ExperienceSource,
        confidence: row.confidence as Confidence,
        feel: (row.feel as SpecialistFeel | null) ?? null,
        dimensions: (row.dimensions ?? {}) as Partial<Record<SpecialistDimensionKey, number>>,
        dimensionConfidence: (row.dimension_confidence ?? {}) as Partial<Record<SpecialistDimensionKey, Confidence>>,
        strengths: row.strengths ?? [],
        weaknesses: row.weaknesses ?? [],
        specialistTags: row.specialist_tags ?? [],
        researchImport: (row.research_import as ExistingProfile['researchImport'] | null | undefined) ?? null,
      }
    }
    return out
  })
}

/** Writes one merged profile: a new row for strings without a profile, a partial update otherwise. */
export function writeProfileRow(row: Record<string, unknown>, isNew: boolean): Promise<AdminResult<void>> {
  return wrap(async () => {
    const client = getSupabaseClient()
    const { string_id: stringId, ...rest } = row
    const query = isNew
      ? client.from('specialist_profiles').insert(row as never)
      : client.from('specialist_profiles').update(rest as never).eq('string_id', String(stringId))
    const { error } = await query
    if (error) throw new Error(error.message)
  })
}

/** Adds built-in strings that are missing from the database catalog (see logic/catalogSync.ts). */
export function insertCatalogStrings(items: StringItem[]): Promise<AdminResult<number>> {
  return wrap(async () => {
    if (items.length === 0) return 0
    const { error } = await getSupabaseClient().from('strings').insert(items.map(stringItemToInsert))
    if (error) throw new Error(error.message)
    return items.length
  })
}
