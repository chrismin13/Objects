# Workspace interface recovery evidence

This record replaces the earlier replacement parity claim. The earlier claim said the typed replacement interface matched the established Objects interface, but the recovery specification and browser evidence showed that it did not.

The recovery stores a production-reference component-gallery capture and a branch capture under `docs/interface-evidence/`. They are byte-identical 1280 × 720 JPEG outputs with SHA-256 `f40bd89d801a42d1b3fca74b3da42b897dd3ca9f731917c3b4ec074dab786ee6`.

## Current result

The Workspace rewrite branch now mounts the established Objects interface again. The failed replacement renderer has been removed. The restored interface reads Workspace documents through `shared/replacement/interface-bridge.ts` and saves through the existing offline and multi-device sync client.

The bridge is intentionally one-way at each boundary:

- Workspace document to the interface state shape for rendering.
- Interface change set through public Workspace lifecycle operations, followed by validated compatibility import for fields that have not migrated yet.
- Workspace document to the sync client for durable saving.

The old `state`, `initializeNormalized`, and `applyChanges` Lakebed APIs are not used by the restored client.

## Automated evidence

Run:

```sh
node --experimental-strip-types --test tests/replacement/*.test.ts
npx lakebed build . --target anonymous --json
```

The bridge tests cover:

- Schedule, This Evening, reminder, Deadline, and checklist projection into the restored interface.
- Editing and checklist ordering across the public Workspace seam.
- Project Closure and after-completion repetition side effects from restored-interface actions.
- Repeating Template identity.
- Preservation of capture receipts and other Workspace-only records.
- Workspace validation after an interface edit.

The existing suite continues to cover Workspace lifecycle rules, organization, repetition, discovery, calendar agenda, import, capture, sync, offline queues, and multi-device merging.

## Browser evidence

On 2026-07-20, the complete local Lakebed app was checked with the guest Workspace at these viewports:

| Viewport | Appearance | Checked |
| --- | --- | --- |
| 1200 × 900 | Light | Sidebar, Today, row density, inline entry, Magic Plus, Quick Find |
| 1440 × 1000 | Dark | Sidebar, Today, inspector, notes, checklist |
| 390 × 844 | Dark | Mobile header, drawer, scrim, full-width inspector |
| 430 × 932 | Light | Mobile layout, touch targets, Magic Plus |

The browser workflows covered inline to-do creation, inspector editing, Markdown notes, checklist creation, save and reload persistence, mobile sidebar and inspector drawers, Settings, appearance changes, Quick Find, and the custom New List dialog. No browser-native prompt, confirm, or alert was active.

## Architecture status

The branch has one visible renderer: the restored Objects interface. The rejected replacement renderer and its packed runtime are gone.

The compatibility interface runtime still owns some temporary interaction and state behavior before it sends a change set across the bridge. This is accepted only for interface recovery. Future behavior migration should move one lifecycle area at a time behind direct Workspace intents without changing the visible markup or CSS. The bridge and compatibility state behavior must not be treated as the final architecture or used for new product behavior.

Production cutover remains out of scope. The branch stays on its separate Lakebed deployment until the owner explicitly accepts it.
