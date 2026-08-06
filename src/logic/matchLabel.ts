// Product feedback: avoid implying unrealistic scientific precision (94%
// vs 93% reads as more "measured" than the underlying scoring actually
// is). The exact percentage is still shown — never hidden — but paired
// with a human category so the headline impression is "a great fit," not
// "93.4th percentile." Thresholds are a product judgment call, not derived
// from any statistical property of the scoring itself.

export type MatchLabel = 'Excellent Match' | 'Great Match' | 'Good Match' | 'Fair Match'

export function getMatchLabel(matchPercent: number): MatchLabel {
  if (matchPercent >= 90) return 'Excellent Match'
  if (matchPercent >= 75) return 'Great Match'
  if (matchPercent >= 60) return 'Good Match'
  return 'Fair Match'
}
