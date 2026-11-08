# TimeLeft demo image

`timeleft-en.png` is an unedited screenshot of this application, captured on
2026-10-27 in an isolated local origin at 907 × 850 CSS pixels. It uses only a
synthetic person named Demo person, birth date 2000-01-01, and a chosen lifespan
of 80 years. Time values are the capture-time display, not fixed examples or a
predicted lifespan. The interface language is English.

The origin initially had no local storage. The person was added through the
application UI; the stored state survived reload byte for byte. The served
`app.js` matched the independently built selected source:

- Selected source seal:
  `a52b61e11a3ee8064a3b3a104be1dfda37eb34fcccc347cd45b1fbff1557e3d7`
- Built bundle SHA-256:
  `1b9b126da90429d3e010b062e4a56f8b621dcf1625983474bc5ff8e479cd7d9f`
- Screenshot SHA-256:
  `2cf979d6f0485e0a6b20879c72ffb3aefcc3fa685e250100b4323c4c9df9d9fd`

This proves the illustrated UI and this isolated save/reload path. It does not
prove every import, browser, device or owner-installed service. No owner
profile, real birth record, Prometheus data or existing service was used.

Reproduce with `deno task build` and `deno task preview`, then add the same
synthetic person in a fresh origin, choose dark theme and close Settings. Use
the existing font and artwork notices in the repository; the screenshot does not
grant rights to third-party components beyond their existing licenses.
