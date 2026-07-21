import assert from "node:assert/strict";
import test from "node:test";

import { hideEmptyToastLayer, placeToastLayer, raiseToastLayer, showToastLayer } from "../../client/toast-layer.ts";

type FakeToastRegion = {
  childElementCount: number;
  open: boolean;
  calls: string[];
  matches(selector: string): boolean;
  showPopover(): void;
  hidePopover(): void;
};

function toastRegion(childElementCount = 1): FakeToastRegion {
  return {
    childElementCount,
    open: false,
    calls: [],
    matches(selector) { return selector === ":popover-open" && this.open; },
    showPopover() { this.calls.push("show"); this.open = true; },
    hidePopover() { this.calls.push("hide"); this.open = false; },
  };
}

test("toasts enter the browser top layer and move above a dialog opened later", () => {
  const region = toastRegion();
  const overlay = { append(child: FakeToastRegion) { child.calls.push("append-to-overlay"); } };

  showToastLayer(region);
  placeToastLayer(region, overlay);
  raiseToastLayer(region);

  assert.deepEqual(region.calls, ["show", "append-to-overlay", "hide", "show"]);
  assert.equal(region.open, true);
});

test("the toast top layer closes only after its final toast disappears", () => {
  const region = toastRegion();
  showToastLayer(region);

  hideEmptyToastLayer(region);
  assert.equal(region.open, true);

  region.childElementCount = 0;
  hideEmptyToastLayer(region);

  assert.deepEqual(region.calls, ["show", "hide"]);
  assert.equal(region.open, false);
});
