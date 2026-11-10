import assert from "node:assert/strict";
import { test } from "node:test";

import { CONFIDENT_MIN, confidenceHue } from "~/lib/confidence.ts";

test("confident scores are green and the rest split into amber and red-orange", () => {
	assert.equal(confidenceHue(1), 150);
	assert.equal(confidenceHue(CONFIDENT_MIN), 150);
	assert.equal(confidenceHue(0.89), 80);
	assert.equal(confidenceHue(0.8), 80);
	assert.equal(confidenceHue(0.79), 35);
});

test("the band follows the rounded percent the pill shows", () => {
	assert.equal(confidenceHue(0.896), 150);
	assert.equal(confidenceHue(0.794), 35);
});

test("scores below the station's floor stay red-orange", () => {
	assert.equal(confidenceHue(0.5), 35);
});
