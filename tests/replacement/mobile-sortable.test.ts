import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sortableSource = await readFile(new URL("../../client/ui/sortable.ts", import.meta.url), "utf8");

test("touch scrolling does not immediately activate item reordering", () => {
  assert.equal(sortableSource.match(/delayOnTouchOnly:\s*true/g)?.length, 3);
  assert.equal(sortableSource.match(/delay:\s*[1-9]\d*/g)?.length, 3);
  assert.equal(sortableSource.match(/touchStartThreshold:\s*[1-9]\d*/g)?.length, 3);
});
