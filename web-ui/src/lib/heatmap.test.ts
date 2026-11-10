import assert from "node:assert/strict";
import { test } from "node:test";

import { heatColorAt, heatInk } from "~/lib/heatmap.ts";

const RAMP_FLOOR = 12;
const shareAtMoss = (moss: number) => (moss - RAMP_FLOOR) / (100 - RAMP_FLOOR);
const countAtMoss = (moss: number) => Math.round(1000 ** shareAtMoss(moss));

test("the ramp steps over the band where no digit reaches 4.5:1", () => {
	assert.match(heatColorAt(shareAtMoss(62)), /var\(--moss\) 66\.0%/);
	assert.match(heatColorAt(shareAtMoss(58)), /var\(--moss\) 58\.0%/);
	assert.match(heatColorAt(shareAtMoss(70)), /var\(--moss\) 70\.0%/);
});

test("digits are dark up to the band and pale from its far side", () => {
	assert.equal(heatInk(countAtMoss(55), 1000), "var(--foreground)");
	assert.equal(heatInk(countAtMoss(63), 1000), "var(--paper)");
	assert.equal(heatInk(countAtMoss(80), 1000), "var(--paper)");
});

test("dark mode steps over its own, wider band", () => {
	assert.match(heatColorAt(shareAtMoss(64), "dark"), /var\(--moss\) 72\.0%/);
	assert.match(heatColorAt(shareAtMoss(54), "dark"), /var\(--moss\) 54\.0%/);
	assert.equal(heatInk(countAtMoss(50), 1000, "dark"), "var(--foreground)");
	assert.equal(heatInk(countAtMoss(64), 1000, "dark"), "var(--paper)");
});
