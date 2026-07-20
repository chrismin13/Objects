import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gunzipSync } from "node:zlib";

async function unpackRuntime(path: string, exportName: string): Promise<string> {
  const moduleSource = await readFile(path, "utf8");
  const marker = `export const ${exportName} = `;
  const markerStart = moduleSource.indexOf(marker);
  assert.notEqual(markerStart, -1, `${path} must export ${exportName}.`);
  const valueStart = markerStart + marker.length;
  const quote = moduleSource[valueStart];
  assert.ok(quote === "`" || quote === '"', `${path} must contain a packed value.`);
  const valueEnd = moduleSource.indexOf(quote, valueStart + 1);
  assert.notEqual(valueStart, -1, `${path} must contain a packed value.`);
  assert.notEqual(valueEnd, -1, `${path} must terminate its packed value.`);
  return gunzipSync(Buffer.from(moduleSource.slice(valueStart + 1, valueEnd).trim(), "base64")).toString("utf8");
}

test("the delivered App runtime uses Preact without requiring a React global", async () => {
  const source = await unpackRuntime("client/runtime/packed.ts", "runtimeCompressed");

  assert.doesNotMatch(source, /React\.createElement/);
  assert.match(source, /Quick find/);
  assert.match(source, /App preferences/);
});

test("the delivered App exposes repetition management and explains Occurrences", async () => {
  const source = await unpackRuntime("client/runtime/packed.ts", "runtimeCompressed");

  assert.match(source, /Active schedules/);
  assert.match(source, /Paused schedules/);
  assert.match(source, /Stopped schedules/);
  assert.match(source, /Editing this to-do changes only this Occurrence/);
  assert.match(source, /Open Repeating Template/);
  assert.match(source, /Project Occurrence skipped/);
  assert.match(source, /Skip Occurrence/);
  assert.match(source, /Open Template Contents/);
  assert.match(source, /Stopped schedule/);
});

test("the delivered mobile theme keeps drawer contents interactive", async () => {
  const source = await unpackRuntime("client/theme/packed.ts", "objectsThemeCompressed");

  assert.match(source, /\.objects-mobile-drawer \.inspector[\s\S]*pointer-events:\s*auto/);
});

test("the restored interface save bridge uses named Workspace changes instead of full import", async () => {
  const source = await readFile("shared/replacement/interface-bridge.ts", "utf8");

  assert.doesNotMatch(source, /importPortableBackup|FULL_IMPORT_CONFIRMATION/);
  assert.match(source, /syncCandidateThroughWorkspace/);
  assert.match(source, /makeProjectRepeating/);
  assert.match(source, /reorderChecklistItems/);
});
