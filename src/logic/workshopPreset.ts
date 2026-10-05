// Hand-over from a quiz result to the Setup Workshop: "Tweak this setup" stores the recommended
// build here, the workshop reads it once on opening and removes it (so a later visit starts fresh).

export interface WorkshopPreset {
  stringId: string
  tensionKg: number
  racketMaxKg?: number
}

const KEY = 'smashlab.workshopPreset'

export function writeWorkshopPreset(storage: Pick<Storage, 'setItem'> | null, preset: WorkshopPreset): void {
  try {
    storage?.setItem(KEY, JSON.stringify(preset))
  } catch {
    // private mode: the workshop simply opens with its defaults
  }
}

export function readWorkshopPreset(storage: Pick<Storage, 'getItem' | 'removeItem'> | null): WorkshopPreset | null {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    storage?.removeItem(KEY)
    const v = JSON.parse(raw) as WorkshopPreset
    return typeof v.stringId === 'string' && typeof v.tensionKg === 'number' ? v : null
  } catch {
    return null
  }
}
