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

For the same deployment constraint, the readable compatibility runtime in `client/objects.ts` is compiled into the local gzip payload in `client/runtime/packed.ts` and loaded by `client/runtime/loader.ts` after the Preact shell mounts. The current minified runtime SHA-256 is `fd9558fe3676393cc0424e07ed0ee01f656569aa8cdc479ce80a17f86e315f7b`. This is a local code-splitting boundary, not a network dependency.

The pure client-side Workspace engine is bundled from `client/workspace/runtime-entry.ts` into `client/workspace/runtime-packed.ts` for the same Lakebed deploy-size limit. Its minified runtime SHA-256 is `9a0c7176567371193cdb0ee356ca7a9502d1d6bb2075cad7e0f2279616f37ce3`. The server continues to use the readable shared modules directly; this packed copy changes only client delivery, not the Workspace interface.

The restored theme modules are joined and gzip-packed into `client/theme/packed.ts` so Lakebed's inline source map does not duplicate the full CSS in the deploy request. The unpacked CSS SHA-256 is `dbb72632c089f8d2a9ad15904e2bce30d80c2953fb3d87da0565e8050c86a389`.
