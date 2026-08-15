import assert from "node:assert/strict";
import { test } from "vite-plus/test";

import sortableSource from "../../client/ui/sortable.ts?raw";
import objectsSource from "../../client/objects.ts?raw";

test("touch scrolling does not immediately activate item reordering", () => {
  assert.equal(sortableSource.match(/delayOnTouchOnly:\s*true/g)?.length, 3);
  assert.equal(sortableSource.match(/delay:\s*[1-9]\d*/g)?.length, 3);
  assert.equal(sortableSource.match(/touchStartThreshold:\s*[1-9]\d*/g)?.length, 3);
});

test("touch reordering has no competing long-press context menu", () => {
  assert.doesNotMatch(objectsSource, /contextPress|handleContextPress|cancelContextPress/);
  assert.match(
    objectsSource,
    /function handleContextMenu\(event\)\s*\{[\s\S]*?event\.button !== 2/,
  );
});
