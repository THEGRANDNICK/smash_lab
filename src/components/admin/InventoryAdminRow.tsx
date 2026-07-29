import { useState } from 'react'
import StockBadge from '../StockBadge'
import ColorSwatchPreview from '../ColorSwatchPreview'
import { buildColorPreview, resolveColor } from '../../logic/stringColor'
import { containsUnambiguousDelimiter, containsSlash, splitColorList, parseLegacyHybridPair } from '../../logic/colorParsing'
import StringColorSwatch from '../StringColorSwatch'
import type { HybridStringMeta, StockLevel } from '../../data/strings'
import {
  STOCK_STATUS_OPTIONS,
  PACKAGE_TYPE_OPTIONS,
  parseQuantityInput,
  normalizeOptionalText,
  updateInventoryRow,
  type AdminInventoryRow,
  type InventoryUpdateInput,
  type PackageType,
} from '../../services/adminInventoryService'

interface InventoryAdminRowProps {
  row: AdminInventoryRow
  onSaved: (updated: AdminInventoryRow) => void
}

type RowState = 'viewing' | 'editing' | 'saving'

export default function InventoryAdminRow({ row, onSaved }: InventoryAdminRowProps) {
  const [state, setState] = useState<RowState>('viewing')
  const [stockStatus, setStockStatus] = useState<StockLevel>(row.stockStatus)
  const [quantityText, setQuantityText] = useState(row.quantity == null ? '' : String(row.quantity))
  const [packageType, setPackageType] = useState<PackageType>(row.packageType)
  const [color, setColor] = useState(row.color ?? '')
  const initialPair = parseLegacyHybridPair(row.color ?? undefined)
  const [mainColorText, setMainColorText] = useState(initialPair?.main ?? '')
  const [crossColorText, setCrossColorText] = useState(initialPair?.cross ?? '')
  const [notes, setNotes] = useState(row.notes ?? '')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  function startEditing() {
    setStockStatus(row.stockStatus)
    setQuantityText(row.quantity == null ? '' : String(row.quantity))
    setPackageType(row.packageType)
    setColor(row.color ?? '')
    const pair = parseLegacyHybridPair(row.color ?? undefined)
    setMainColorText(pair?.main ?? '')
    setCrossColorText(pair?.cross ?? '')
    setNotes(row.notes ?? '')
    setValidationError(null)
    setSaveError(null)
    setState('editing')
  }

  function cancelEditing() {
    setState('viewing')
    setValidationError(null)
    setSaveError(null)
  }

  async function save() {
    const parsedQuantity = parseQuantityInput(quantityText)
    if (!parsedQuantity.ok) {
      setValidationError(parsedQuantity.error)
      return
    }
    setValidationError(null)
    setSaveError(null)
    setState('saving')

    // For a hybrid row, the two clean Main/Cross fields are joined into
    // the same single legacy "Main/Cross" text value the public site
    // already knows how to split back apart (logic/colorParsing.ts's
    // parseLegacyHybridPair) — the admin never has to type the slash.
    const resolvedColor = row.isHybrid
      ? mainColorText.trim() && crossColorText.trim()
        ? `${mainColorText.trim()}/${crossColorText.trim()}`
        : mainColorText.trim() || crossColorText.trim() || ''
      : color

    const patch: InventoryUpdateInput = {
      stockStatus,
      quantity: parsedQuantity.value,
      packageType,
      color: normalizeOptionalText(resolvedColor),
      notes: normalizeOptionalText(notes),
    }

    const result = await updateInventoryRow(row.stringId, patch)

    if (!result.ok) {
      setSaveError(result.error)
      setState('editing')
      return
    }

    onSaved({ ...row, ...patch, updatedAt: new Date().toISOString() })
    setState('viewing')
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2500)
  }

  const isEditing = state === 'editing' || state === 'saving'

  return (
    <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-shuttle-600">{row.brand}</p>
          <h3 className="font-display text-lg font-bold text-ink-900 dark:text-shuttle-50">{row.name}</h3>
          <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40 font-mono">{row.stringId}</p>
        </div>
        {!isEditing && <StockBadge stock={row.stockStatus} />}
      </div>

      {!isEditing ? (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
            <Field label="Quantity" value={row.quantity == null ? '—' : String(row.quantity)} />
            <Field label="Package" value={row.packageType} />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">Color</dt>
              <dd className="text-ink-900 dark:text-shuttle-50">
                <InventoryColorPreview row={row} />
              </dd>
            </div>
            <Field label="Notes" value={row.notes || '—'} />
          </dl>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-700/40 dark:text-shuttle-100/40">Updated {new Date(row.updatedAt).toLocaleString()}</p>
            <div className="flex items-center gap-3">
              {savedFlash && <span className="text-xs font-semibold text-green-700 dark:text-green-400">✓ Saved</span>}
              <button
                type="button"
                onClick={startEditing}
                className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-4 py-1.5 hover:bg-court-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Stock status</span>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value as StockLevel)}
                disabled={state === 'saving'}
                className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
              >
                {STOCK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Quantity</span>
              <input
                type="text"
                inputMode="numeric"
                value={quantityText}
                onChange={(e) => setQuantityText(e.target.value)}
                disabled={state === 'saving'}
                placeholder="e.g. 3"
                className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
              />
            </label>

            <label className="block text-sm">
              <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Package type</span>
              <select
                value={packageType}
                onChange={(e) => setPackageType(e.target.value as PackageType)}
                disabled={state === 'saving'}
                className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
              >
                {PACKAGE_TYPE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            {row.isHybrid ? (
              <>
                <ColorNameField
                  label="Main string color"
                  value={mainColorText}
                  onChange={setMainColorText}
                  disabled={state === 'saving'}
                  hint="The main string's currently-stocked color, e.g. White."
                />
                <ColorNameField
                  label="Cross string color"
                  value={crossColorText}
                  onChange={setCrossColorText}
                  disabled={state === 'saving'}
                  hint="The cross string's currently-stocked color, e.g. Red."
                />
              </>
            ) : (
              <label className="block text-sm">
                <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Color</span>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={state === 'saving'}
                  placeholder="e.g. Yellow — optional"
                  className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
                />
                <span className="block text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1">
                  Enter one physical color for this inventory item, e.g. White or Sky Blue. To list more than one currently-available color, separate them with commas (e.g. "White, Red") — each shows as its own swatch.
                </span>
                {containsSlash(color) && (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1">A "/" is ambiguous here — use a comma to list multiple colors instead (e.g. "White, Red").</p>
                )}
                {containsUnambiguousDelimiter(color) && splitColorList(color).length > 1 && (
                  <p className="text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1">Will be shown as {splitColorList(color).length} separate colors: {splitColorList(color).join(', ')}.</p>
                )}
              </label>
            )}
          </div>

          <label className="block text-sm">
            <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={state === 'saving'}
              rows={2}
              placeholder="optional"
              className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
            />
          </label>

          {validationError && (
            <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
              {validationError}
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
              Save failed: {saveError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={state === 'saving'}
              className="focus-ring rounded-full bg-shuttle-500 hover:bg-shuttle-600 disabled:opacity-60 disabled:cursor-not-allowed text-court-900 font-bold text-sm px-5 py-2 transition-colors cursor-pointer"
            >
              {state === 'saving' ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={state === 'saving'}
              className="focus-ring rounded-full border-2 border-court-900/15 dark:border-white/20 font-semibold text-sm px-5 py-2 hover:bg-court-900/5 dark:hover:bg-white/10 disabled:opacity-60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const RESOLUTION_SOURCE_LABEL: Record<string, string> = {
  explicit_css: 'Value entered is already a CSS color',
  explicit_override: 'Explicit override',
  css_named_color: 'Recognized CSS color name',
  inferred_keyword: 'Resolved automatically from keyword',
  alias: 'Resolved via known alias',
}

/**
 * A single-line color entry with a live resolved-swatch preview, so an
 * admin sees immediately whether "Fire Orange" or similar will render on
 * the public site, and why (Part 16: raw name + resolved swatch +
 * resolution source), without a separate override field here — the
 * hybrid override fields live in the Catalog admin form (see
 * CatalogStringForm.tsx's HybridColorField).
 */
function ColorNameField({ label, value, onChange, disabled, hint }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; hint: string }) {
  const resolution = resolveColor(value)
  return (
    <label className="block text-sm">
      <span className="block font-semibold text-ink-900 dark:text-shuttle-50 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="optional"
        className="focus-ring w-full rounded-lg border-2 border-court-900/10 dark:border-white/15 bg-white/90 dark:bg-white/5 px-3 py-2 text-ink-900 dark:text-shuttle-50 disabled:opacity-60"
      />
      <span className="block text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1">{hint}</span>
      {value.trim() !== '' && (
        <p className="flex items-center gap-1.5 text-xs text-ink-700/50 dark:text-shuttle-100/50 mt-1">
          {resolution.cssColor ? (
            <>
              <StringColorSwatch swatch={{ label: resolution.displayName, hex: resolution.cssColor, ringClassName: resolution.ringClassName }} size="sm" />
              {RESOLUTION_SOURCE_LABEL[resolution.source] ?? resolution.source}
            </>
          ) : (
            <span className="text-amber-700 dark:text-amber-400 font-semibold">Needs color value — no automatic match found</span>
          )}
        </p>
      )}
    </label>
  )
}

/**
 * Shows the mapped swatch(es) beside the raw color text and the
 * resolution source (Part 16), the raw text always staying visible —
 * this is admin UI, not the compact public card. Reuses
 * buildColorPreview/ColorSwatchPreview so an admin sees exactly what the
 * public site would render for this row, including the hybrid split
 * (from structured Main/Cross catalog fields, or a legacy "Main/Cross"
 * combined value as a fallback — see logic/stringColor.ts). A row whose
 * raw text doesn't resolve to anything gets a "Needs mapping" marker
 * rather than silently showing no swatch with no explanation.
 */
function InventoryColorPreview({ row }: { row: AdminInventoryRow }) {
  const previewItem = {
    isHybrid: row.isHybrid,
    mainString: row.isHybrid ? ({ color: row.mainColor } as HybridStringMeta) : undefined,
    crossString: row.isHybrid ? ({ color: row.crossColor } as HybridStringMeta) : undefined,
    inventoryColor: row.color ?? undefined,
    colors: undefined,
    stock: row.stockStatus,
  }
  const preview = buildColorPreview(previewItem)
  const hasRawColor = Boolean(row.color && row.color.trim() !== '')
  const needsMapping = hasRawColor && preview.kind === 'none'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ColorSwatchPreview item={previewItem} size="sm" />
      <span>{row.color || '—'}</span>
      {needsMapping && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">⚠ Needs mapping</span>}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">{label}</dt>
      <dd className="text-ink-900 dark:text-shuttle-50">{value}</dd>
    </div>
  )
}
