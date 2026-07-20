# Local production bundles

These files are pinned local bundles. They are not application source and should not be edited manually.

## SortableJS

- Package: `sortablejs`
- Version: `1.15.7`
- Source tarball: `https://registry.npmjs.org/sortablejs/-/sortablejs-1.15.7.tgz`
- Tarball SHA-1: `83a0bddc472117ee328dea20b2e6f490fed20f86`
- Local bundle SHA-256: `a9220e5862660167d253469b79c93071c5d1a83cd8361e69813df73b0a9c2ca0`
- License: MIT, retained in `sortablejs/LICENSE`

The bundle comes from `modular/sortable.complete.esm.js` and includes MultiDrag. Its exact minified source is stored as a gzip-compressed module payload and loaded without a network request.

## Replacement Workspace runtime

The complete production Workspace lives in `client/replacement/runtime-entry.tsx`. Its minified source is gzip-packed into `client/replacement/packed.ts` and loaded by `client/replacement/loader.ts` so the owned Lakebed deploy stays below the upload limit without a CDN or runtime network request.

Bundle the runtime with esbuild's automatic Preact JSX mode, then run:

```sh
node scripts/pack-runtime.mjs <minified-runtime> client/replacement/packed.ts replacementRuntimeCompressed
```

The legacy imperative renderer, its packed payload, its component gallery, and Web Awesome were removed at final cutover. SortableJS remains behind `client/ui/sortable.ts`, where drag intent is translated into a Workspace change.
