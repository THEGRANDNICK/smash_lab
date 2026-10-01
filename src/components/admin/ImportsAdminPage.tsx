import { useEffect, useMemo, useState } from 'react'
import { parseImagePackManifest, planImageImport, type ImagePackManifest, type PlannedSide, type PlannedString } from '../../logic/imagePack'
import { buildProfileRow, parseResearchPack, planResearchMerge, takenFields, type ExistingProfile, type ProfilePlan, type ResearchPack } from '../../logic/researchPack'
import {
  fetchCatalogImageState,
  fetchExistingProfiles,
  insertCatalogStrings,
  checkImportReadiness,
  prepareImage,
  readJson,
  readZip,
  saveStringImages,
  sha256Hex,
  uploadStringImage,
  writeProfileRow,
  IMAGE_MAX_SIDE,
  type CatalogImageState,
} from '../../services/importAdminService'
import { DIMENSION_OPTIONS } from '../../services/specialistAdminService'
import type { StringImageMetaJson } from '../../types/database'
import { strings as builtInStrings, type StringItem } from '../../data/strings'
import { missingFromDatabase } from '../../logic/catalogSync'

/**
 * Admin → Imports. Two importers for the packs prepared outside the app:
 * - string images (front/back packet photos, smash_lab_string_images_*.zip)
 * - external specialist research (smash_lab_specialist_research_*.zip or specialist_profiles.json)
 * Both always show a preview first and write nothing until "Import" is clicked.
 */
export default function ImportsAdminPage() {
  const [tab, setTab] = useState<'images' | 'research'>('images')
  // Bumped after missing strings are added, so the importers re-read the catalog from scratch.
  const [refreshKey, setRefreshKey] = useState(0)
  // null = still checking. Imports stay locked until the database has proven it can store them.
  const [problems, setProblems] = useState<string[] | null>(null)
  const runCheck = () => {
    setProblems(null)
    void checkImportReadiness().then(setProblems)
  }
  useEffect(runCheck, [])
  const blocked = problems == null || problems.length > 0
  return (
    <div className="space-y-6">
      <ReadinessBanner problems={problems} onRecheck={runCheck} />
      <MissingCatalogBanner onAdded={() => setRefreshKey((k) => k + 1)} />
      <div className="flex gap-2" role="tablist" aria-label="Importer">
        {(
          [
            ['images', 'String images'],
            ['research', 'Specialist research'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold cursor-pointer ${tab === id ? 'bg-court-800 text-white' : 'border-2 border-court-900/15 dark:border-white/20'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'images' ? <ImageImportPanel key={`img-${refreshKey}`} blocked={blocked} /> : <ResearchImportPanel key={`res-${refreshKey}`} blocked={blocked} />}
    </div>
  )
}

function ReadinessBanner({ problems, onRecheck }: { problems: string[] | null; onRecheck: () => void }) {
  if (problems == null) return <p className="text-sm text-ink-700/80 dark:text-shuttle-100/80">Checking that the database is ready for imports…</p>
  if (problems.length === 0) return <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Database ready for imports (test upload succeeded).</p>
  return (
    <div role="alert" className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4 text-sm">
      <p className="font-semibold">The database isn't ready for imports yet — nothing can be saved until this is fixed:</p>
      <ul className="list-disc pl-5 mt-2 space-y-1">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <button type="button" onClick={onRecheck} className="focus-ring mt-3 rounded-full border-2 border-court-900/20 dark:border-white/30 px-4 py-1.5 font-semibold cursor-pointer">
        Check again
      </button>
    </div>
  )
}

/**
 * Strings that exist in the built-in data but not in the database. While any are missing, the
 * public site ignores the whole live catalog (and with it every imported image) and shows the
 * built-in data — so this is shown above both importers with a one-click fix.
 */
function MissingCatalogBanner({ onAdded }: { onAdded: () => void }) {
  const [missing, setMissing] = useState<StringItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchCatalogImageState().then((r) => {
      if (!cancelled && r.ok) setMissing(missingFromDatabase(builtInStrings, new Set(r.data.map((c) => c.id))))
    })
    return () => {
      cancelled = true
    }
  }, [message])

  if (!missing || missing.length === 0) return message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null

  async function add() {
    setBusy(true)
    const result = await insertCatalogStrings(missing ?? [])
    setBusy(false)
    if (result.ok) {
      setMessage(`✓ Added ${result.data} string(s) to the database. The public site now uses your live catalog (reload it to see).`)
      onAdded()
    } else setMessage(`Could not add them: ${result.error}`)
  }

  return (
    <div role="alert" className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4 text-sm">
      <p className="font-semibold">
        {missing.length} string{missing.length === 1 ? ' is' : 's are'} missing from your database: {missing.map((s) => `${s.brand} ${s.name}`).join(', ')}.
      </p>
      <p className="mt-1">
        While any built-in string is missing, the public site ignores your whole live catalog — including imported images, prices and stock — and shows the built-in
        data instead. Adding them copies their built-in details into the database; you can edit them in Catalog afterwards.
      </p>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="focus-ring mt-3 rounded-full bg-court-800 hover:bg-court-700 disabled:opacity-50 text-white font-bold px-5 py-2 cursor-pointer"
      >
        {busy ? 'Adding…' : `Add ${missing.length} string${missing.length === 1 ? '' : 's'} to the database`}
      </button>
      {message && <p className="mt-2">{message}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ images */

const SIDE_STATUS_LABEL: Record<PlannedSide['status'], string> = {
  new: 'new',
  changed: 'changed',
  unchanged: 'already imported',
  'not-in-pack': 'not in pack',
  'file-missing': 'file missing in zip',
  'hash-mismatch': 'checksum wrong — skipped',
}

interface LoadedImagePack {
  manifest: ImagePackManifest
  entries: Record<string, Uint8Array>
  catalog: CatalogImageState[]
  plan: PlannedString[]
}

function ImageImportPanel({ blocked }: { blocked: boolean }) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [pack, setPack] = useState<LoadedImagePack | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  async function load(file: File) {
    setLoading(true)
    setErrors([])
    setPack(null)
    setLog([])
    try {
      const entries = await readZip(file)
      if (!entries['image_manifest.json']) throw new Error('image_manifest.json not found — is this the string image pack?')
      const parsed = parseImagePackManifest(readJson(entries['image_manifest.json']))
      if (!parsed.ok) {
        setErrors(parsed.errors)
        return
      }
      const hashes: Record<string, string> = {}
      for (const asset of parsed.value.assets) if (entries[asset.file]) hashes[asset.file] = await sha256Hex(entries[asset.file])
      const catalog = await fetchCatalogImageState()
      if (!catalog.ok) throw new Error(`Could not read the catalog: ${catalog.error}`)
      const existing = Object.fromEntries(catalog.data.map((c) => [c.id, { frontSha: c.meta?.front?.sha256, backSha: c.meta?.back?.sha256 }]))
      const plan = planImageImport(parsed.value, new Set(catalog.data.map((c) => c.id)), existing, hashes)
      setPack({ manifest: parsed.value, entries, catalog: catalog.data, plan })
      setSelected(new Set(plan.filter((p) => p.hasChanges).map((p) => p.stringId)))
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)])
    } finally {
      setLoading(false)
    }
  }

  async function runImport() {
    if (!pack) return
    const todo = pack.plan.filter((p) => selected.has(p.stringId) && p.hasChanges)
    const lines: string[] = []
    for (const [i, item] of todo.entries()) {
      setProgress(`Importing ${i + 1} of ${todo.length}: ${item.stringId}`)
      const current = pack.catalog.find((c) => c.id === item.stringId)
      const meta: StringImageMetaJson = { ...(current?.meta ?? {}), packId: pack.manifest.packId, importedAt: new Date().toISOString() }
      const update: { image_url?: string; image_back_url?: string; image_meta: StringImageMetaJson } = { image_meta: meta }
      let failed = false
      for (const side of [item.front, item.back]) {
        if (side.status !== 'new' && side.status !== 'changed') continue
        try {
          const prepared = await prepareImage(pack.entries[side.file!])
          const uploaded = await uploadStringImage(item.stringId, side.side, side.sha256!, prepared)
          if (!uploaded.ok) throw new Error(uploaded.error)
          if (side.side === 'front') update.image_url = uploaded.data
          else update.image_back_url = uploaded.data
          meta[side.side] = { sha256: side.sha256!, source: side.sourcePage, note: item.notes.join(' ') || undefined }
        } catch (err) {
          failed = true
          lines.push(`✗ ${item.stringId} ${side.side}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (update.image_url || update.image_back_url) {
        const saved = await saveStringImages(item.stringId, update)
        lines.push(saved.ok ? `✓ ${item.stringId}${failed ? ' (partly)' : ''}` : `✗ ${item.stringId}: ${saved.error}`)
      }
      setLog([...lines])
    }
    setProgress(null)
    setLog([...lines, `Done. Reload the public site to see the images.`])
  }

  const counts = useMemo(() => {
    if (!pack) return null
    const sides = pack.plan.flatMap((p) => [p.front.status, p.back.status])
    return { new: sides.filter((s) => s === 'new').length, changed: sides.filter((s) => s === 'changed').length, same: sides.filter((s) => s === 'unchanged').length, problems: sides.filter((s) => s === 'file-missing' || s === 'hash-mismatch').length }
  }, [pack])

  return (
    <section className="space-y-4">
      <Intro
        title="Import string images"
        text={`Upload the image pack zip (e.g. smash_lab_string_images_2026-10-01.zip). Files are matched by exact string id from image_manifest.json, checked against their SHA-256, scaled to at most ${IMAGE_MAX_SIDE}px and saved as WebP. Images already imported with the same checksum are skipped.`}
      />
      <FilePicker accept=".zip" label="Choose image pack (.zip)" onFile={load} disabled={loading || progress != null} />
      {loading && <p className="text-sm">Reading zip, checking checksums…</p>}
      <ErrorList errors={errors} />

      {pack && counts && (
        <>
          <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-4 text-sm">
            <strong>Image rights:</strong> the pack marks these as third-party product photos with no verified reuse licence. The source of every image is stored with it
            (image_meta), so you can review or replace them later.
          </div>
          <p className="text-sm">
            {pack.plan.length} strings · {counts.new} new images · {counts.changed} changed · {counts.same} already imported{counts.problems ? ` · ${counts.problems} with problems` : ''}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pack.plan.map((item) => (
              <li key={item.stringId} className={`rounded-xl border-2 p-3 ${item.known ? 'border-court-900/10 dark:border-white/10' : 'border-red-500/50'}`}>
                <label className="flex items-center gap-2 font-semibold text-sm">
                  <input
                    type="checkbox"
                    disabled={!item.hasChanges || progress != null}
                    checked={selected.has(item.stringId)}
                    onChange={(e) => setSelected((prev) => toggle(prev, item.stringId, e.target.checked))}
                  />
                  {item.stringId}
                  {!item.known && <span className="text-red-600 dark:text-red-400 font-normal">· not in catalog — skipped</span>}
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[item.front, item.back].map((side) => (
                    <figure key={side.side} className="text-xs">
                      <div className="aspect-square rounded-lg bg-white flex items-center justify-center overflow-hidden">
                        {side.file && pack.entries[side.file] ? <BytesImage bytes={pack.entries[side.file]} alt={`${item.stringId} ${side.side}`} /> : <span className="text-ink-700/60">—</span>}
                      </div>
                      <figcaption className="mt-1">
                        {side.side}: <StatusText status={side.status} />
                      </figcaption>
                    </figure>
                  ))}
                </div>
                {item.notes.length > 0 && (
                  <details className="mt-2 text-xs text-ink-700/80 dark:text-shuttle-100/80">
                    <summary className="cursor-pointer">Packaging notes ({item.notes.length})</summary>
                    <ul className="list-disc pl-4 mt-1">
                      {item.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
          <ImportBar count={selected.size} busy={progress != null} blocked={blocked} progress={progress} onImport={runImport} noun="string" />
        </>
      )}
      <Log lines={log} />
    </section>
  )
}

function StatusText({ status }: { status: PlannedSide['status'] }) {
  const tone = status === 'new' || status === 'changed' ? 'text-emerald-700 dark:text-emerald-400' : status === 'unchanged' || status === 'not-in-pack' ? 'text-ink-700/70 dark:text-shuttle-100/70' : 'text-red-600 dark:text-red-400'
  return <span className={`font-semibold ${tone}`}>{SIDE_STATUS_LABEL[status]}</span>
}

function BytesImage({ bytes, alt }: { bytes: Uint8Array; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([bytes.slice().buffer]))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [bytes])
  return url ? <img src={url} alt={alt} className="max-h-full max-w-full object-contain" /> : null
}

/* ---------------------------------------------------------------- research */

const DIMENSION_LABEL = Object.fromEntries(DIMENSION_OPTIONS.map((d) => [d.key, d.label])) as Record<string, string>

interface LoadedResearch {
  pack: ResearchPack
  existing: Record<string, ExistingProfile>
  conflicts: Record<string, string[]>
}

function ResearchImportPanel({ blocked }: { blocked: boolean }) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [data, setData] = useState<LoadedResearch | null>(null)
  const [plans, setPlans] = useState<ProfilePlan[]>([])
  const [onlyChanges, setOnlyChanges] = useState(true)
  const [progress, setProgress] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  async function load(file: File) {
    setLoading(true)
    setErrors([])
    setData(null)
    setLog([])
    try {
      let profilesJson: unknown
      let conflictsJson: unknown
      if (file.name.toLowerCase().endsWith('.zip')) {
        const entries = await readZip(file)
        if (!entries['specialist_profiles.json']) throw new Error('specialist_profiles.json not found in this zip — is this the research pack?')
        profilesJson = readJson(entries['specialist_profiles.json'])
        if (entries['conflicts.json']) conflictsJson = readJson(entries['conflicts.json'])
      } else {
        profilesJson = JSON.parse(await file.text())
      }
      const parsed = parseResearchPack(profilesJson)
      if (!parsed.ok) {
        setErrors(parsed.errors)
        return
      }
      const [catalog, existing] = await Promise.all([fetchCatalogImageState(), fetchExistingProfiles()])
      if (!catalog.ok) throw new Error(`Could not read the catalog: ${catalog.error}`)
      if (!existing.ok) throw new Error(`Could not read the specialist profiles: ${existing.error}`)
      const conflicts: Record<string, string[]> = {}
      const list = (conflictsJson as { conflicts?: { stringId?: string; local?: string; external?: string; decision?: string }[] } | undefined)?.conflicts ?? []
      for (const c of list) if (c.stringId) (conflicts[c.stringId] ??= []).push(`Yours: ${c.local ?? '—'} · Research: ${c.external ?? '—'} · ${c.decision ?? ''}`)
      setData({ pack: parsed.value, existing: existing.data, conflicts })
      setPlans(planResearchMerge(parsed.value, new Set(catalog.data.map((c) => c.id)), existing.data))
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)])
    } finally {
      setLoading(false)
    }
  }

  function update(stringId: string, change: (p: ProfilePlan) => ProfilePlan) {
    setPlans((prev) => prev.map((p) => (p.stringId === stringId ? change(p) : p)))
  }

  async function runImport() {
    if (!data) return
    const importedAt = new Date().toISOString()
    const todo = plans.filter((p) => p.known && takenFields(p).length > 0)
    const lines: string[] = []
    for (const [i, plan] of todo.entries()) {
      setProgress(`Importing ${i + 1} of ${todo.length}: ${plan.stringId}`)
      const row = buildProfileRow(plan, data.pack, data.existing[plan.stringId], importedAt)
      if (!row) continue
      const result = await writeProfileRow(row, plan.isNew)
      lines.push(result.ok ? `✓ ${plan.stringId}: ${takenFields(plan).length} field(s)${plan.isNew ? ' — new community profile' : ''}` : `✗ ${plan.stringId}: ${result.error}`)
      setLog([...lines])
    }
    setProgress(null)
    setLog([...lines, 'Done. Re-open this importer to see the updated state; the public site picks it up on reload.'])
  }

  const visible = onlyChanges ? plans.filter((p) => !p.known || takenFields(p).length > 0 || p.dimensions.some((d) => !d.take)) : plans
  const totalFields = plans.reduce((n, p) => n + (p.known ? takenFields(p).length : 0), 0)
  const stringsToWrite = plans.filter((p) => p.known && takenFields(p).length > 0).length

  return (
    <section className="space-y-4">
      <Intro
        title="Import specialist research"
        text="Upload the research pack zip (or its specialist_profiles.json). By default only EMPTY values are filled — values you entered yourself are never replaced unless you tick them. Strings without a profile get a new profile marked as community research. Which fields came from which dataset is saved with each profile."
      />
      <FilePicker accept=".zip,.json" label="Choose research pack (.zip or .json)" onFile={load} disabled={loading || progress != null} />
      {loading && <p className="text-sm">Reading and validating…</p>}
      <ErrorList errors={errors} />

      {data && (
        <>
          {data.pack.scoreMeaning && <p className="text-sm text-ink-700/80 dark:text-shuttle-100/80">Note from the pack: {data.pack.scoreMeaning}.</p>}
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} /> Only show strings with something to decide
          </label>
          <ul className="space-y-3">
            {visible.map((plan) => (
              <ResearchCard key={plan.stringId} plan={plan} conflicts={data.conflicts[plan.stringId] ?? []} disabled={progress != null} onChange={(change) => update(plan.stringId, change)} />
            ))}
          </ul>
          <ImportBar count={stringsToWrite} busy={progress != null} blocked={blocked} progress={progress} onImport={runImport} noun="string" extra={`${totalFields} field(s)`} />
        </>
      )}
      <Log lines={log} />
    </section>
  )
}

function ResearchCard({ plan, conflicts, disabled, onChange }: { plan: ProfilePlan; conflicts: string[]; disabled: boolean; onChange: (change: (p: ProfilePlan) => ProfilePlan) => void }) {
  const fills = plan.dimensions.filter((d) => d.current == null).length
  const kept = plan.dimensions.filter((d) => d.current != null && !d.take).length
  return (
    <li className={`rounded-xl border-2 p-4 ${plan.known ? 'border-court-900/10 dark:border-white/10' : 'border-red-500/50'}`}>
      <details open={!plan.known || conflicts.length > 0}>
        <summary className="cursor-pointer flex flex-wrap items-center gap-2">
          <span className="font-semibold">{plan.stringId}</span>
          {!plan.known ? (
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">not in catalog — skipped</span>
          ) : plan.isNew ? (
            <span className="text-xs font-semibold rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5">new community profile</span>
          ) : (
            <span className="text-xs text-ink-700/80 dark:text-shuttle-100/80">
              fills {fills} empty value(s){kept ? ` · ${kept} of yours kept` : ''}
            </span>
          )}
          {conflicts.length > 0 && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">⚠ disagrees with your notes</span>}
        </summary>

        {conflicts.length > 0 && (
          <ul className="mt-2 text-xs rounded-lg bg-amber-500/10 p-2 space-y-1">
            {conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}

        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-700/70 dark:text-shuttle-100/70">
              <th className="font-semibold">Dimension</th>
              <th className="font-semibold">Yours</th>
              <th className="font-semibold">Research</th>
              <th className="font-semibold">Use research</th>
            </tr>
          </thead>
          <tbody>
            {plan.dimensions.map((d) => (
              <tr key={d.key} className="border-t border-court-900/5 dark:border-white/5">
                <td className="py-1">{DIMENSION_LABEL[d.key] ?? d.key}</td>
                <td>{d.current ?? '—'}</td>
                <td>
                  {d.proposed}
                  {d.proposedConfidence && <span className="text-xs text-ink-700/60 dark:text-shuttle-100/60"> ({d.proposedConfidence})</span>}
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Use research value for ${DIMENSION_LABEL[d.key] ?? d.key}`}
                    disabled={disabled || !plan.known}
                    checked={d.take}
                    onChange={(e) => onChange((p) => ({ ...p, dimensions: p.dimensions.map((x) => (x.key === d.key ? { ...x, take: e.target.checked } : x)) }))}
                  />
                  {d.current != null && d.take && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">replaces yours</span>}
                </td>
              </tr>
            ))}
            {plan.feel.proposed && (
              <tr className="border-t border-court-900/5 dark:border-white/5">
                <td className="py-1">Feel</td>
                <td>{plan.feel.current ?? '—'}</td>
                <td>{plan.feel.proposed}</td>
                <td>
                  <input type="checkbox" aria-label="Use research feel" disabled={disabled || !plan.known} checked={plan.feel.take} onChange={(e) => onChange((p) => ({ ...p, feel: { ...p.feel, take: e.target.checked } }))} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {!plan.isNew && plan.known && (
          <label className="mt-2 inline-flex items-center gap-2 text-xs">
            <input type="checkbox" disabled={disabled} checked={plan.addTexts} onChange={(e) => onChange((p) => ({ ...p, addTexts: e.target.checked }))} />
            Also add the research strengths, trade-offs and tags to your lists (yours are kept)
          </label>
        )}
      </details>
    </li>
  )
}

/* ----------------------------------------------------------------- shared */

function toggle(prev: Set<string>, id: string, on: boolean): Set<string> {
  const next = new Set(prev)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-ink-700/80 dark:text-shuttle-100/80 max-w-3xl">{text}</p>
    </div>
  )
}

function FilePicker({ accept, label, onFile, disabled }: { accept: string; label: string; onFile: (f: File) => void; disabled: boolean }) {
  return (
    <label className={`inline-flex items-center gap-3 rounded-full bg-shuttle-500 text-court-900 font-bold px-5 py-2.5 ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-shuttle-600'}`}>
      {label}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </label>
  )
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <div role="alert" className="rounded-xl border-2 border-red-500/50 bg-red-500/10 p-3 text-sm">
      <p className="font-semibold">Nothing was imported:</p>
      <ul className="list-disc pl-5 mt-1">
        {errors.slice(0, 15).map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {errors.length > 15 && <p className="mt-1">…and {errors.length - 15} more.</p>}
    </div>
  )
}

function ImportBar({ count, busy, blocked, progress, onImport, noun, extra }: { count: number; busy: boolean; blocked: boolean; progress: string | null; onImport: () => void; noun: string; extra?: string }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 px-4 py-3 bg-shuttle-50/95 dark:bg-[#0c1210]/95 border-t border-court-900/10 dark:border-white/10 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onImport}
        disabled={busy || blocked || count === 0}
        className="focus-ring rounded-full bg-court-800 hover:bg-court-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 cursor-pointer"
      >
        Import {count} {noun}
        {count === 1 ? '' : 's'}
        {extra ? ` (${extra})` : ''}
      </button>
      {progress && <span className="text-sm">{progress}</span>}
      {blocked && !busy && <span className="text-sm font-semibold text-red-600 dark:text-red-400">Locked until the database check above passes.</span>}
      {!blocked && count === 0 && !busy && <span className="text-sm text-ink-700/70 dark:text-shuttle-100/70">Nothing selected or nothing to change.</span>}
    </div>
  )
}

function Log({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  const ok = lines.filter((l) => l.startsWith('✓')).length
  const failed = lines.filter((l) => l.startsWith('✗'))
  const done = lines.some((l) => l.startsWith('Done.'))
  return (
    <div aria-live="polite" className="space-y-2">
      {done && (
        <div className={`rounded-xl border-2 p-4 text-sm font-semibold ${failed.length ? 'border-red-500/60 bg-red-500/10' : 'border-emerald-600/50 bg-emerald-600/10'}`}>
          {failed.length === 0 ? `✓ All ${ok} imported successfully.` : `✗ ${failed.length} failed, ${ok} succeeded. First problem: ${failed[0].replace(/^✗\s*/, '')}`}
        </div>
      )}
      <details open={failed.length > 0}>
        <summary className="cursor-pointer text-sm">Full log ({lines.length} lines)</summary>
        <pre className="mt-2 rounded-xl bg-court-900/5 dark:bg-white/5 p-3 text-xs whitespace-pre-wrap">{lines.join('\n')}</pre>
      </details>
    </div>
  )
}
