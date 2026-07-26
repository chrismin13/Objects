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

The production bundle contains Button, Button Group, Checkbox, Details, Dialog, Divider, Drawer, Dropdown, Dropdown Item, Option, Progress Ring, Select, Switch, Tab, Tab Group, Tab Panel, Tag, Tooltip, and their transitive runtime code. It was generated from the package's self-contained `dist-cdn` entries with esbuild minification and retained legal comments, and is vendored verbatim as `webawesome.js` (imported for side effects at startup). Native text, search, textarea, date, time, and color fields remain preferable where the browser already provides the required behavior. The default theme's CSS imports were flattened and exported as a string in `theme.ts`.

## SortableJS

- Package: `sortablejs`
- Version: `1.15.7`
- Source tarball: `https://registry.npmjs.org/sortablejs/-/sortablejs-1.15.7.tgz`
- Tarball SHA-1: `83a0bddc472117ee328dea20b2e6f490fed20f86`
- Local bundle SHA-256: `a9220e5862660167d253469b79c93071c5d1a83cd8361e69813df73b0a9c2ca0`
- License: MIT, retained in `sortablejs/LICENSE`

The local bundle is generated from `modular/sortable.complete.esm.js` and includes the MultiDrag plugin, vendored verbatim as `sortable.js` with a minimal typed surface in `sortable.d.ts`.

These pinned bundles are stored as plain files. The recorded SHA-256 hashes above verify their bytes against the upstream artifacts.
