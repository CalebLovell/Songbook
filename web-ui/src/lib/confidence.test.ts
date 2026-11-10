import assert from "node:assert/strict";
import { test } from "node:test";

import { confidenceHue } from "~/lib/confidence.ts";

test("the ramp runs red-orange at 70% to green at 100%", () => {
	assert.equal(confidenceHue(0.7), 48);
	assert.equal(confidenceHue(1), 140);
	assert.ok(confidenceHue(0.85) > 48 && confidenceHue(0.85) < 140);
});

test("scores below the station's floor stay red-orange", () => {
	assert.equal(confidenceHue(0.5), 48);
});
