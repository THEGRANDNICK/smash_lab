# Space Grotesk

Self-hosted via [`@fontsource/space-grotesk`](https://www.npmjs.com/package/@fontsource/space-grotesk)
(npm, MIT-licensed *packaging*, SIL Open Font License 1.1 *font*), which
repackages the official [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk)
release (Florian Karsten, The Space Grotesk Project Authors) as static
WOFF2/WOFF files for self-hosting — no request to `fonts.googleapis.com` or
`fonts.gstatic.com` at runtime.

Only the 4 weights the app actually uses are imported (`400.css`, `500.css`,
`600.css`, `700.css` — see `src/index.css`), each of which already sets
`font-display: swap` and lists `woff2` before `woff`.

See `LICENSE` in this directory for the full SIL OFL-1.1 text.
