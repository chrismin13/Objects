import assert from "node:assert/strict";
import { test } from "vite-plus/test";

import modalitySource from "../../client/input-modality.ts?raw";
import interactionStyles from "../../client/mobile-interaction-styles.ts?raw";
import objectsSource from "../../client/objects.ts?raw";
import responsiveStyles from "../../client/responsive-styles.ts?raw";
import webAwesomeSource from "../../client/ui/webawesome.ts?raw";

test("touch focus restoration is disabled without weakening keyboard focus", () => {
  assert.match(modalitySource, /event\.key === "Tab"[\s\S]*?objects-keyboard-navigation/);
  assert.match(
    modalitySource,
    /pointerdown[\s\S]*?classList\.remove\("objects-keyboard-navigation"\)/,
  );
  assert.match(responsiveStyles, /html\.objects-keyboard-navigation[\s\S]*?outline: 2px solid/);
  assert.match(webAwesomeSource, /pointerType !== "mouse"[\s\S]*?originalTrigger = null/);
  assert.match(webAwesomeSource, /addEventListener\("wa-hide", onHide\)/);
  assert.match(objectsSource, /installOverlayInputPolicy\(drawer\)/);
  assert.match(objectsSource, /restoreFocus &&[\s\S]*?keyboardNavigationActive\(\)/);
});

test("a sidebar drag does not activate its starting row when there is nothing to scroll", () => {
  assert.match(objectsSource, /function handleSidebarTouchStart/);
  assert.match(objectsSource, /Math\.hypot\([\s\S]*?> 8[\s\S]*?suppressSidebarClickUntil/);
  assert.match(
    objectsSource,
    /suppressSidebarClickUntil > Date\.now\(\)[\s\S]*?preventDefault\(\)/,
  );
});

test("scrolling list rows do not use a raw touch-duration active style", () => {
  assert.doesNotMatch(
    interactionStyles,
    /:where\([\s\S]*?\.nav-item[\s\S]*?\):active[\s\S]*?opacity/,
  );
  assert.match(
    interactionStyles,
    /\.nav-item:not\(\.active\):hover[\s\S]*?background: transparent/,
  );
});
