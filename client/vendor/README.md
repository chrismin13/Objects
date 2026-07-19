# Vendored UI dependencies

These files are pinned, locally bundled upstream dependencies. They are not application source and should not be edited manually.

## Web Awesome

- Package: `@awesome.me/webawesome`
- Version: `3.10.0`
- Source tarball: `https://registry.npmjs.org/@awesome.me/webawesome/-/webawesome-3.10.0.tgz`
- Tarball SHA-1: `85930336d5aa5f54bc28f771a0439cf3d44b4c73`
- Local bundle SHA-256: `7ff4c5eed4a08d11e9708b1e065005d4c8be0a187895a3787719c4e82654e06c`
- Flattened default theme SHA-256: `305220884e052cf511cd14ec490ea9d116476755ee393472e795056c0ae802f5`
- License: MIT, retained in `webawesome/LICENSE.md`

The production bundle contains Button, Button Group, Checkbox, Details, Dialog, Divider, Drawer, Dropdown, Dropdown Item, Option, Progress Ring, Select, Switch, Tab, Tab Group, Tab Panel, Tag, Tooltip, and their transitive runtime code. It was generated from the package's self-contained `dist-cdn` entries with esbuild minification and retained legal comments. Lakebed reformats JavaScript modules while bundling, so the exact minified bundle is stored as a gzip-compressed local module payload and registered at startup through `loader.ts`; this keeps the deploy request below Lakebed's request limit without a CDN or runtime network request. Native text, search, textarea, date, time, and color fields remain preferable where the browser already provides the required behavior. The default theme's CSS imports were flattened and exported as a string because Lakebed client modules do not process CSS imports.

## SortableJS

- Package: `sortablejs`
- Version: `1.15.7`
- Source tarball: `https://registry.npmjs.org/sortablejs/-/sortablejs-1.15.7.tgz`
- Tarball SHA-1: `83a0bddc472117ee328dea20b2e6f490fed20f86`
- Local bundle SHA-256: `a9220e5862660167d253469b79c93071c5d1a83cd8361e69813df73b0a9c2ca0`
- License: MIT, retained in `sortablejs/LICENSE`

The local bundle is generated from `modular/sortable.complete.esm.js` and includes the MultiDrag plugin. Like Web Awesome, its exact minified source is stored as a gzip-compressed local module payload and loaded without a network request so Lakebed does not expand it in the deploy artifact.

The local-only production-themed component gallery lives at `client/features/gallery/component-gallery.tsx` and is available with `?ui_gallery=1` on localhost. It is imported by the production entrypoint so the same theme and component registration path are exercised, but the route guard prevents it from bypassing hosted authentication.

For the same deployment constraint, the readable compatibility runtime in `client/objects.ts` is compiled into the local gzip payload in `client/runtime/packed.ts` and loaded by `client/runtime/loader.ts` after the Preact shell mounts. The current minified runtime SHA-256 is `2ecacd8470b454bff244ae0a0aea8149e1ca674871fc967926d1075e1ba01346`. This is a local code-splitting boundary, not a network dependency.

The production Workspace uses the same local boundary. Its readable Preact source is `client/replacement/runtime-entry.tsx`; the minified source is gzip-packed into `client/replacement/packed.ts` and loaded by `client/replacement/loader.ts`. The current minified runtime SHA-256 is `e348054043db29ca5219507ed60757159ffcd53f3fb0339c78cb0b7046617f45`. Bundle it with esbuild's automatic Preact JSX mode, then run `node scripts/pack-runtime.mjs <minified-runtime> client/replacement/packed.ts replacementRuntimeCompressed`. This keeps the owned deploy request below Lakebed's upload limit without a CDN or runtime network request.
