# Runtime packaging

Lakebed includes inline source maps in deploy requests and rejects request bodies larger than 2 MiB. Objects keeps its readable source and uses four generated delivery files so the restored interface and Workspace engine fit that limit:

- `client/runtime/packed.ts` contains the gzip-packed compatibility interface runtime built from `client/objects.ts`.
- `client/theme/packed.ts` contains the gzip-packed complete visual theme built from `client/theme/index.ts`.
- `client/workspace/runtime-packed.ts` contains the gzip-packed browser Workspace runtime built from `client/workspace/runtime-entry.ts`.
- `server/workspace-runtime.ts` is the minified server Workspace runtime built from `server/workspace-runtime-entry.ts`.

The readable files are the source of truth. The generated files only change how the same code is delivered. Rebuild all four together with:

```sh
node scripts/build-runtimes.mjs
```

The script uses the `esbuild` copy already bundled with `npx lakebed`; it does not install another dependency. It compiles JSX for Preact and produces deterministic packed files.

After rebuilding these files, run:

```sh
node --experimental-strip-types --test tests/replacement/*.test.ts
npx lakebed build . --target anonymous --json
node scripts/check-build-artifact.mjs
```

Lakebed's hard maximum is 2,097,152 bytes. The guard uses an Objects safety limit of 2,080,000 bytes so a build fails before it reaches the platform limit.
