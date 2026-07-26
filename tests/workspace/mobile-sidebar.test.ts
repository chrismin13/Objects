import assert from "node:assert/strict";
import { test } from "vite-plus/test";

import objectsSource from "../../client/objects.ts?raw";

test("tapping outside the mobile sidebar dismisses its drawer", () => {
  assert.match(
    objectsSource,
    /if \(placement === "start"\) \{[\s\S]*?drawer\.setAttribute\("light-dismiss", ""\);[\s\S]*?\}/,
  );
});
