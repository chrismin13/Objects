# Vendored UI dependencies

These files are pinned, locally bundled upstream dependencies. They are not application source and should not be edited manually.

## Web Awesome

- Package: `@awesome.me/webawesome`
- Version: `3.10.0`
- Source tarball: `https://registry.npmjs.org/@awesome.me/webawesome/-/webawesome-3.10.0.tgz`
- Tarball SHA-1: `85930336d5aa5f54bc28f771a0439cf3d44b4c73`
- Local bundle SHA-256: `9606ce635f51df8b6b2997e40c1ea2da3682481d9b69ea6824b89b1448752444`
- Flattened default theme SHA-256: `305220884e052cf511cd14ec490ea9d116476755ee393472e795056c0ae802f5`
- License: MIT, retained in `webawesome/LICENSE.md`

The production bundle contains Dialog, Drawer, Dropdown, Dropdown Item, and their transitive runtime code. It was generated from the package's self-contained `dist-cdn` entries with esbuild minification and retained legal comments. Lakebed reformats JavaScript modules while bundling, so the exact minified bundle is stored as a gzip-compressed local module payload and registered at startup through `loader.ts`; this keeps the deploy request below Lakebed's 2 MB limit without a CDN or runtime network request. Native inputs, selects, checkboxes, and buttons remain preferable where the browser already provides the required behavior. The default theme's CSS imports were flattened and exported as a string because Lakebed client modules do not process CSS imports.

## SortableJS

- Package: `sortablejs`
- Version: `1.15.7`
- Source tarball: `https://registry.npmjs.org/sortablejs/-/sortablejs-1.15.7.tgz`
- Tarball SHA-1: `83a0bddc472117ee328dea20b2e6f490fed20f86`
- Local bundle SHA-256: `a9220e5862660167d253469b79c93071c5d1a83cd8361e69813df73b0a9c2ca0`
- License: MIT, retained in `sortablejs/LICENSE`

The local bundle is generated from `modular/sortable.complete.esm.js` and includes the MultiDrag plugin. Like Web Awesome, its exact minified source is stored as a gzip-compressed local module payload and loaded without a network request so Lakebed does not expand it in the deploy artifact.

The private component/domain harness remains in `client/ui-harness.tsx` for local migration work, but is deliberately not imported by the production entrypoint because Lakebed deploys a single client bundle with a 2 MB request limit.

For the same deployment constraint, the readable compatibility runtime in `client/objects.ts` is compiled into the local gzip payload in `client/runtime/packed.ts` and loaded by `client/runtime/loader.ts` after the Preact shell mounts. The current minified runtime SHA-256 is `758e8b45fad400a4f673fdb22baf90473d858aee242b96abd39b9607b0c8a0fb`. This is a local code-splitting boundary, not a network dependency.
