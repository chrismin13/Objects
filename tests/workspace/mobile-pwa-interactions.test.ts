import assert from "node:assert/strict";
import { test } from "vite-plus/test";

import interactionStyles from "../../client/mobile-interaction-styles.ts?raw";
import indexSource from "../../client/index.tsx?raw";
import pwaSource from "../../client/pwa.ts?raw";

test("installed iOS startup locks viewport and multi-touch scaling", () => {
  assert.match(indexSource, /initializeStandalonePwaInteractions\(\)/);
  assert.match(
    pwaSource,
    /if \(!isIos\(\) \|\| !isInstalled\(\)\) return;[\s\S]*?classList\.add\("objects-ios-standalone"\)/,
  );
  assert.match(pwaSource, /maximum-scale=1, user-scalable=no/);
  assert.match(pwaSource, /touches\.length > 1[\s\S]*?preventDefault\(\)[\s\S]*?passive: false/);
});

test("mobile inspector scrolls vertically without temporal controls widening it", () => {
  assert.match(interactionStyles, /\.inspector-scroll[\s\S]*?overflow-x: hidden/);
  assert.match(
    interactionStyles,
    /input:is\([\s\S]*?\[type="datetime-local"\][\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;[\s\S]*?overflow: hidden/,
  );
});
