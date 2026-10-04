// Review findings (Oct 2026): what reaches the stringer must be complete and unambiguous,
// and a shared link must show the same string the sender chose.
import { describe, it, expect } from 'vitest'
import { buildResultSummaryText } from './contactMessage'
import { decodeResultShareState, encodeResultShareState } from './resultShareState'

const base = { stringName: 'Yonex BG80', tensionKg: 11.5, matchPercent: 85, dataSourceLabel: 'Calibrated' }

describe('message to the stringer', () => {
  it('spells out mains and crosses, and marks the average as an average', () => {
    const text = buildResultSummaryText({ ...base, mainsKg: 11, crossKg: 12 })
    expect(text).toMatch(/mains 11\.0 kg \/ crosses 12\.0 kg \(average 11\.5 kg\)/)
  })
  it('says plainly when the racket maximum was not checked', () => {
    expect(buildResultSummaryText({ ...base, mainsKg: 11, crossKg: 12 })).toMatch(/Racket max: NOT CHECKED/)
    expect(buildResultSummaryText({ ...base, mainsKg: 11, crossKg: 12, racketMaxKg: 12.7 })).toMatch(/Racket max: 12\.7 kg \/ 28 lbs \(checked\)/)
  })
  it('calls the score a ranking score, not a probability', () => {
    expect(buildResultSummaryText(base)).toMatch(/not a probability/)
    expect(buildResultSummaryText(base)).not.toMatch(/Match: 85%/)
  })
})

describe('shared result links', () => {
  const answers = { level: 'advanced', playStyles: ['aggressive'], priorities: ['hardAttack'], hittingFeel: 'hardCrisp' }
  it('carry the string the sender chose', () => {
    const decoded = decodeResultShareState(encodeResultShareState(answers, 'manufacturer-specialist', 'yonex-exbolt-63'))
    expect(decoded?.featuredId).toBe('yonex-exbolt-63')
    expect(decoded?.answers.level).toBe('advanced')
  })
  it('links made before this change still open (no chosen string)', () => {
    const fresh = encodeResultShareState(answers, 'manufacturer-specialist')
    const [version, body] = [fresh.slice(0, fresh.indexOf(':')), decodeURIComponent(fresh.slice(fresh.indexOf(':') + 1))]
    const oldBody = body.slice(0, body.lastIndexOf(body.includes('~') ? '~' : '|')) // drop the appended field
    const sep = body.includes('~') ? '~' : '|'
    const legacy = `${version}:${encodeURIComponent(oldBody)}`
    const decoded = decodeResultShareState(legacy)
    expect(oldBody.split(sep).length).toBe(body.split(sep).length - 1)
    expect(decoded?.answers.level).toBe('advanced')
    expect(decoded?.featuredId).toBeUndefined()
  })
  it('ignore anything that is not a plain string id', () => {
    const decoded = decodeResultShareState(encodeResultShareState(answers, 'manufacturer-specialist', '<script>'))
    expect(decoded?.featuredId).toBeUndefined()
  })
})
