import assert from "node:assert/strict";
import { test } from "vite-plus/test";

import interfaceSource from "../../client/objects.ts?raw";
import featureStyles from "../../client/feature-styles.ts?raw";

test("mobile bulk-selection controls stay hidden until selection mode begins", () => {
  assert.match(
    interfaceSource,
    /class="content-inner \$\{ui\.selectedTaskIds\.size \? ["']selection-active["'] : ["']["']\}"/,
  );
  assert.doesNotMatch(
    featureStyles,
    /\.task-select \{ width: 44px; height: 44px; margin: -8px 0; opacity: 1; \}/,
  );
  assert.match(featureStyles, /\.selection-active \.task-select\s*\{\s*opacity:\s*1;/);
});
