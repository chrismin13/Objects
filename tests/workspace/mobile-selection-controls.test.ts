import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const interfaceSource = await readFile(new URL("../../client/objects.ts", import.meta.url), "utf8");
const featureStyles = await readFile(new URL("../../client/feature-styles.ts", import.meta.url), "utf8");

test("mobile bulk-selection controls stay hidden until selection mode begins", () => {
  assert.match(interfaceSource, /class="content-inner \$\{ui\.selectedTaskIds\.size \? 'selection-active' : ''\}"/);
  assert.doesNotMatch(featureStyles, /\.task-select \{ width: 44px; height: 44px; margin: -8px 0; opacity: 1; \}/);
  assert.match(featureStyles, /\.selection-active \.task-select\s*\{\s*opacity:\s*1;/);
});
