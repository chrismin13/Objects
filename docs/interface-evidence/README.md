# Interface evidence

`production-component-gallery.jpg` is captured from commit `021efbb`, the restored production application. `branch-component-gallery.jpg` is captured from this branch at the same 1280 × 720 browser size and state. Both use the local-only `/?ui_gallery=1` visual-contract route.

The two JPEG files have the same SHA-256 digest:

```text
f40bd89d801a42d1b3fca74b3da42b897dd3ca9f731917c3b4ec074dab786ee6
```

Verify the stored comparison with:

```sh
shasum -a 256 docs/interface-evidence/*.jpg
```

The full browser verification record, tested viewports, appearances, and workflows are listed in `docs/replacement-parity-audit.md`.

The 2026-07-21 repetition repair also has three direct browser captures:

- `repeating-template-actions-fixed.png` shows that a Template has a repeat marker and opens for inspection, without completion or bulk-selection controls.
- `stopped-template-read-only.png` shows the stopped Template inspector on desktop.
- `stopped-template-mobile.png` shows the same read-only inspector in the mobile drawer.

The exact workflows, browser log counts, bundle hash, and screenshot hashes are stored in `browser-verification.json`. Verify that record with:

```sh
node scripts/verify-interface-evidence.mjs
```
