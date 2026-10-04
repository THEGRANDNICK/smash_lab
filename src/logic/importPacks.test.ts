import { describe, it, expect } from 'vitest'
import { fitWithin, isSafeImageName, parseImagePackManifest, planImageImport, sniffImageType, storagePath } from './imagePack'
import { buildProfileRow, buildRestoreRow, parseResearchPack, planResearchMerge, takenFields, type ExistingProfile } from './researchPack'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const manifest = {
  schemaVersion: '1.0.0',
  packType: 'smash-lab-string-images',
  generatedAt: '2026-10-01',
  strings: {
    'yonex-bg80': { baseName: 'BG80', front: 'BG80_f.jpg', back: 'BG80_b.png', notes: ['note'] },
    'yonex-bg80-power': { baseName: 'BG80Power', front: 'BG80Power_f.jpg', back: null, notes: [] },
    'made-up-string': { baseName: 'X', front: 'X_f.jpg', back: null, notes: [] },
  },
  assets: [
    { stringId: 'yonex-bg80', side: 'front', file: 'BG80_f.jpg', sha256: SHA_A },
    { stringId: 'yonex-bg80', side: 'back', file: 'BG80_b.png', sha256: SHA_B },
    { stringId: 'yonex-bg80-power', side: 'front', file: 'BG80Power_f.jpg', sha256: SHA_A },
    { stringId: 'made-up-string', side: 'front', file: 'X_f.jpg', sha256: SHA_A },
  ],
}

describe('image pack', () => {
  it('accepts only flat, documented file names', () => {
    expect(isSafeImageName('BG80_f.jpg')).toBe(true)
    expect(isSafeImageName('LiNingNo1Boost_b.png')).toBe(true)
    for (const bad of ['../BG80_f.jpg', 'dir/BG80_f.jpg', 'BG80_x.jpg', 'BG80_f.gif', 'BG 80_f.jpg', 'BG80_f.jpg.exe']) expect(isSafeImageName(bad)).toBe(false)
  })

  it('rejects the wrong pack type, version or unsafe names', () => {
    expect(parseImagePackManifest({ ...manifest, packType: 'other' }).ok).toBe(false)
    expect(parseImagePackManifest({ ...manifest, schemaVersion: '2.0.0' }).ok).toBe(false)
    const unsafe = { ...manifest, strings: { 'yonex-bg80': { front: '../evil_f.jpg', back: null } } }
    expect(parseImagePackManifest(unsafe).ok).toBe(false)
  })

  it('plans exact-id matches only, verifies hashes, and treats identical re-imports as no-ops', () => {
    const parsed = parseImagePackManifest(manifest)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const catalog = new Set(['yonex-bg80', 'yonex-bg80-power'])
    const plan = planImageImport(parsed.value, catalog, { 'yonex-bg80': { frontSha: SHA_A } }, { 'BG80_f.jpg': SHA_A, 'BG80_b.png': SHA_B, 'BG80Power_f.jpg': 'c'.repeat(64), 'X_f.jpg': SHA_A })
    const bg80 = plan.find((p) => p.stringId === 'yonex-bg80')!
    expect(bg80.front.status).toBe('unchanged') // same hash already imported
    expect(bg80.back.status).toBe('new')
    const power = plan.find((p) => p.stringId === 'yonex-bg80-power')!
    expect(power.front.status).toBe('hash-mismatch') // bytes don't match the manifest → never imported
    expect(power.back.status).toBe('not-in-pack')
    expect(power.hasChanges).toBe(false)
    const unknown = plan.find((p) => p.stringId === 'made-up-string')!
    expect(unknown.known).toBe(false)
    expect(unknown.hasChanges).toBe(false)
  })

  it('detects real image types and sizes images down, never up', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull()
    expect(fitWithin(2400, 1200, 800)).toEqual({ width: 800, height: 400 })
    expect(fitWithin(500, 300, 800)).toEqual({ width: 500, height: 300 })
    expect(storagePath('yonex-bg80', 'front', SHA_A, 'webp')).toBe('yonex-bg80/front-aaaaaaaaaaaa.webp')
  })
})

const pack = {
  schemaVersion: '1.0.0',
  datasetId: 'test-dataset',
  profiles: {
    'yonex-bg80': {
      experienceSource: 'community',
      confidence: 'medium',
      reviewer: 'External synthesis',
      feel: 'hard',
      dimensions: { controlPrecision: 4.5, easyPower: 3.5, tensionRetention: 4 },
      dimensionConfidence: { controlPrecision: 'medium', tensionRetention: 'low' },
      strengths: ['Grippy'],
      weaknesses: ['Less rebound'],
      specialistTags: ['control'],
      subjectiveNotes: 'External research synthesis.',
    },
    'yonex-skyarc': { experienceSource: 'community', confidence: 'low', dimensions: { comfort: 4.5 }, dimensionConfidence: {}, strengths: [], weaknesses: [], specialistTags: [] },
    'unknown-id': { experienceSource: 'community', confidence: 'low', dimensions: { comfort: 3 } },
  },
}

const nickBg80: ExistingProfile = {
  experienceSource: 'mixed',
  confidence: 'very-high',
  feel: 'hard',
  dimensions: { controlPrecision: 5, easyPower: 4 },
  dimensionConfidence: {},
  strengths: ['Excellent attacking control'],
  weaknesses: [],
  specialistTags: [],
  researchImport: null,
}

describe('research pack', () => {
  it('rejects numeric strings, out-of-range scores, unknown fields and dimensions', () => {
    const bad = (dims: unknown, extra: Record<string, unknown> = {}) =>
      parseResearchPack({ ...pack, profiles: { 'yonex-bg80': { experienceSource: 'community', confidence: 'medium', dimensions: dims, ...extra } } }).ok
    expect(bad({ comfort: '4' })).toBe(false)
    expect(bad({ comfort: 6 })).toBe(false)
    expect(bad({ comfort: Number.NaN })).toBe(false)
    expect(bad({ sound: 3 })).toBe(false)
    expect(bad({ comfort: 3 }, { mapPlacement: {} })).toBe(false)
    expect(bad({ comfort: 3 })).toBe(true)
  })

  it('never overwrites hands-on values by default — only fills gaps', () => {
    const parsed = parseResearchPack(pack)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const plans = planResearchMerge(parsed.value, new Set(['yonex-bg80', 'yonex-skyarc']), { 'yonex-bg80': nickBg80 })
    const bg80 = plans.find((p) => p.stringId === 'yonex-bg80')!
    expect(bg80.dimensions.find((d) => d.key === 'controlPrecision')!.take).toBe(false) // Nick has 5
    expect(bg80.dimensions.find((d) => d.key === 'tensionRetention')!.take).toBe(true) // empty → filled
    expect(bg80.feel.take).toBe(false)
    expect(bg80.addTexts).toBe(false)

    const row = buildProfileRow(bg80, parsed.value, nickBg80, '2026-10-01')!
    expect(row.dimensions).toEqual({ controlPrecision: 5, easyPower: 4, tensionRetention: 4 })
    expect(row.dimension_confidence).toEqual({ tensionRetention: 'low' })
    expect(row).not.toHaveProperty('experience_source') // Nick's own source/confidence stay
    expect(row).not.toHaveProperty('confidence')
    expect(row.research_import).toEqual({ datasetId: 'test-dataset', importedAt: '2026-10-01', fields: ['dimensions.tensionRetention'] })
  })

  it('creates a full community profile where none exists, and shows unknown ids without importing them', () => {
    const parsed = parseResearchPack(pack)
    if (!parsed.ok) throw new Error('parse failed')
    const plans = planResearchMerge(parsed.value, new Set(['yonex-bg80', 'yonex-skyarc']), {})
    const sky = plans.find((p) => p.stringId === 'yonex-skyarc')!
    const row = buildProfileRow(sky, parsed.value, undefined, '2026-10-01')!
    expect(row.experience_source).toBe('community')
    expect(row.dimensions).toEqual({ comfort: 4.5 })
    const unknown = plans.find((p) => p.stringId === 'unknown-id')!
    expect(unknown.known).toBe(false)
    expect(buildProfileRow(unknown, parsed.value, undefined, '2026-10-01')).toBeNull()
  })

  it('is idempotent: importing the same choices twice gives the same row', () => {
    const parsed = parseResearchPack(pack)
    if (!parsed.ok) throw new Error('parse failed')
    const bg80 = planResearchMerge(parsed.value, new Set(['yonex-bg80']), { 'yonex-bg80': nickBg80 }).find((p) => p.stringId === 'yonex-bg80')!
    const first = buildProfileRow(bg80, parsed.value, nickBg80, 'T')!
    const afterFirst: ExistingProfile = {
      ...nickBg80,
      dimensions: first.dimensions as ExistingProfile['dimensions'],
      dimensionConfidence: first.dimension_confidence as ExistingProfile['dimensionConfidence'],
      researchImport: first.research_import as ExistingProfile['researchImport'],
    }
    const again = planResearchMerge(parsed.value, new Set(['yonex-bg80']), { 'yonex-bg80': afterFirst }).find((p) => p.stringId === 'yonex-bg80')!
    expect(takenFields(again)).toEqual([]) // nothing left to fill → nothing written
    expect(buildProfileRow(again, parsed.value, afterFirst, 'T')).toBeNull()
  })
})

describe('research pack — replace mode with backup and restore', () => {
  const parsed = parseResearchPack(pack)
  if (!parsed.ok) throw new Error('parse failed')
  const plans = planResearchMerge(parsed.value, new Set(['yonex-bg80']), { 'yonex-bg80': nickBg80 }, 'replace')
  const bg80 = plans.find((p) => p.stringId === 'yonex-bg80')!

  it('replace mode takes every research value, including ones Nick already set', () => {
    expect(bg80.dimensions.every((d) => d.take)).toBe(true)
    const row = buildProfileRow(bg80, parsed.value, nickBg80, 'T')!
    expect(row.dimensions).toEqual({ controlPrecision: 4.5, easyPower: 3.5, tensionRetention: 4 })
  })

  it("backs up exactly Nick's overwritten values, and restore brings them back", () => {
    const row = buildProfileRow(bg80, parsed.value, nickBg80, 'T')!
    const ri = row.research_import as { replaced?: { dimensions?: Record<string, number> } }
    expect(ri.replaced?.dimensions).toEqual({ controlPrecision: 5, easyPower: 4 })
    const afterImport: ExistingProfile = {
      ...nickBg80,
      dimensions: row.dimensions as ExistingProfile['dimensions'],
      dimensionConfidence: (row.dimension_confidence ?? {}) as ExistingProfile['dimensionConfidence'],
      researchImport: row.research_import as ExistingProfile['researchImport'],
    }
    const restored = buildRestoreRow('yonex-bg80', afterImport)!
    expect(restored.dimensions).toEqual({ controlPrecision: 5, easyPower: 4, tensionRetention: 4 })
    expect((restored.research_import as { replaced?: unknown }).replaced).toBeUndefined()
  })

  it('a second replace import never loses the original backup', () => {
    const first = buildProfileRow(bg80, parsed.value, nickBg80, 'T')!
    const afterFirst: ExistingProfile = {
      ...nickBg80,
      dimensions: first.dimensions as ExistingProfile['dimensions'],
      dimensionConfidence: (first.dimension_confidence ?? {}) as ExistingProfile['dimensionConfidence'],
      researchImport: first.research_import as ExistingProfile['researchImport'],
    }
    const again = planResearchMerge(parsed.value, new Set(['yonex-bg80']), { 'yonex-bg80': afterFirst }, 'replace').find((p) => p.stringId === 'yonex-bg80')!
    const second = buildProfileRow(again, parsed.value, afterFirst, 'T2')!
    expect((second.research_import as { replaced?: { dimensions?: Record<string, number> } }).replaced?.dimensions).toEqual({ controlPrecision: 5, easyPower: 4 })
  })
})
