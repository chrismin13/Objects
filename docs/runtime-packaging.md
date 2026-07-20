# Runtime packaging

Lakebed includes inline source maps in deploy requests and rejects request bodies larger than 2 MiB. Objects keeps its readable source and uses three generated delivery files so the restored interface and Workspace engine fit that limit:

- `client/runtime/packed.ts` contains the gzip-packed compatibility interface runtime built from `client/objects.ts`.
- `client/workspace/runtime-packed.ts` contains the gzip-packed browser Workspace runtime built from `client/workspace/runtime-entry.ts`.
- `server/workspace-runtime.ts` is the minified server Workspace runtime built from `server/workspace-runtime-entry.ts`.

The readable files are the source of truth. The generated files only change how the same code is delivered. Their current unpacked SHA-256 values are recorded in `client/vendor/README.md`; the server runtime SHA-256 is `acaf556614ff9238293c83030e790115b88c4f19d4908d86cae4af59c84abdae`.

After rebuilding these files, run:

```sh
node --experimental-strip-types --test tests/replacement/*.test.ts
npx lakebed build . --target anonymous --json
wc -c .lakebed/artifacts/Objects.anonymous.json
```

The final artifact must stay below 2,097,152 bytes before deployment.
