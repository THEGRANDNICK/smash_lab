# Analysis scripts

Reproducible checks of the recommendation engine. Same input → same numbers (fixed seed,
deterministic enumeration). Run from the repository root:

```
npx tsx scripts/analysis/quickVsDetailed.ts
npx tsx scripts/analysis/robustness.ts
npx tsx scripts/analysis/beginnerGauge.ts
npx tsx scripts/analysis/unratedHandling.ts
```

## What they show — and what they don't

These measure the engine's **internal consistency and stability**. They do **not** show that a
recommendation is right for a real player; that needs blind tests and feedback from players.

- Answer combinations are **weighted equally**. They are not a sample of real users.
- The detailed quiz is **not a ground truth** for the quick one: both run on the same engine.
- Random noise (robustness) tests stability, **not systematic bias** of a single rater.
- Ranking points are model scores, **not probabilities**.

## Results (smashlab-v2, October 2026)

| Script | Result |
|---|---|
| quickVsDetailed | 118,800 sets · same best 80.0% · quick pick in detailed top 3 97.9% · same tension 64.2% · within 0.5 kg 98.8% |
| robustness | 2,200 sets × 8 runs, seed 7 · lead 0–2: 58.5% of sets, 3–5: 31.3%, 6+: 10.2% |
| robustness ±0.5 | best changes 21.6% · new best already in top 3 98.0% · by lead 0–2: 34.3%, 3–5: 4.9%, 6+: 0.4% |
| robustness ±1 | best changes 31.1% · new best already in top 3 95.4% · by lead 0–2: 45.1%, 3–5: 14.3%, 6+: 2.2% |
| beginnerGauge | 9,900 beginner sets · best string < 0.68 mm: 0.2% (a soft guardrail, not a guarantee; before it: ~53%) |
| unratedHandling | wins by strings with NO hands-on ratings: midpoint (default) 0.3% · estimate 11.5% · estimateWithCoverage 28.9% |

Why the default stays 'midpoint': hands-on ratings correct the inflated packet ratings downwards,
so the less an unrated property is held back, the more often untested strings win. The result page
says when a pick rests on little hands-on data.

The ranking labels on the result page ("close call" ≤2, "ahead" 3–5, "clear lead" ≥6 points)
come from the robustness lead buckets. Re-run after every larger data import.
