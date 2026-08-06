# Recommendation engine

`src/logic/recommendationEngine.ts`'s `recommendStrings(answers, pool?,
specialistProfiles?)` is a pure function — same inputs always produce the
same output, no network calls, no side effects. This is what makes
shareable result links (`src/logic/resultShareState.ts`) and browser
regression tests (`scripts/testCalibration.ts` and others) possible: a
result can be reproduced exactly from its inputs alone.

## Scoring

Every quiz answer nudges a weighted profile across five manufacturer
rating dimensions (repulsion, control, durability, comfort/shock
absorption, hitting sound) — see `src/config/recommendationWeights.ts`
for the exact per-answer weights. Each catalog string is scored against
that profile; strings that specifically excel at what the player
prioritized are favored over strings that are just generally decent
across every dimension. The result is `topThree` (the top 3 by match
percent, in ranked order — `topThree[0]` is always the same object as
`best`), plus a cross-brand alternative and a specialist-choice pick when
one is genuinely differentiated.

Availability (in-stock/low-stock/unavailable) is never part of the score
itself — it's surfaced separately (`bestAvailable`) so an out-of-stock
string can still be the honest best match, with the best available
alternative shown alongside it rather than silently substituted in.

## Tension

`src/logic/tensionRecommendation.ts` is a fully separate calculation from
string scoring, so either can be tuned independently. It starts from a
level-based range (`src/config/tensionRules.ts`), adjusts for stated
racket goal and current-tension feel if known, and — critically — is
capped at the player's stated racket maximum minus a safety margin,
never exceeding it regardless of what the level-based math alone would
suggest.

## Data-source toggle (manufacturer vs. specialist)

`src/logic/dataSourcePreference.ts`'s `resolveSpecialistProfiles()` is
the entire implementation: manufacturer-only mode passes `{}` as the
`specialistProfiles` argument, manufacturer+specialist mode passes the
real map through unchanged. `recommendStrings()` itself was never
modified for this — it already produced manufacturer-only scoring
whenever given an empty specialist-profile map, so the toggle is purely
a display/input-selection choice at the call site, not a second scoring
path. The chosen mode's human-readable label
(`DATA_SOURCE_NOTE`) is shown near the result so it's always clear which
data the ranking is based on.

## String Map ("feel map")

`src/logic/stringMapPosition.ts`'s `computeStringMapPosition()` derives a
string's 2D position from real data fields — never a hardcoded per-string
coordinate. Horizontal axis (Maximum Hold ↔ Quick Repulsion) comes
directly from the manufacturer `repulsion` rating, optionally nudged by a
capped amount from a specialist's `shuttleGripHold` assessment. Vertical
axis (Soft Feel ↔ Hard Feel) uses the most specific signal available, in
order: specialist `softness`/`directness` dimensions, then `comfort`,
then the specialist's coarser `feel` label, then manufacturer
`shockAbsorption` as a last resort, and only a documented neutral
midpoint when nothing at all is known. Every position is honestly
"directional," never presented as a precise measurement.

## Match percentage — human labels

`src/logic/matchLabel.ts`'s `getMatchLabel()` buckets the exact match
percentage into Excellent/Great/Good/Fair Match. The precise percentage
is still always shown — never hidden — but the human label is given more
visual weight, since a 94%-vs-93% comparison implies more measurement
precision than the underlying scoring actually has.

## Explanations

`src/logic/recommendationExplanation.ts` builds every human-readable
reason shown to a player — headline, strengths/trade-offs, and the
one-sentence podium reasons (`buildPodiumBestReason`/
`buildPodiumAlternativeReason`) — entirely from the engine's own already-
computed output (top dimensions, specialist profile). It never
introduces a second, independent judgment about why a string was
recommended.

## What's deliberately never touched by this phase's UI work

Per the project's own scope discipline, no phase since the engine's
initial build has changed its actual scoring math, weights, or tension
rules as a side effect of a UI/presentation change — every UI-facing
addition (podium, String Map, data-source toggle, shareable results)
consumes the engine's existing output or adds a purely optional
parameter with a default that reproduces prior behavior exactly. See
`docs/CHANGELOG.md` for the phase-by-phase detail of when and why each
optional parameter was added.
