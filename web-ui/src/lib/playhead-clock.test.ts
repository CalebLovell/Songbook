import assert from "node:assert/strict";
import test from "node:test";

import { startPlayheadClock, tickPlayheadClock } from "~/lib/playhead-clock.ts";

test("glides between coarse media time updates", () => {
	let clock = startPlayheadClock(0, 0);
	clock = tickPlayheadClock(clock, 0, 100, 1);
	assert.equal(clock.shown, 0.1);
	clock = tickPlayheadClock(clock, 0, 200, 1);
	assert.equal(clock.shown, 0.2);
});

test("holds still rather than jumping back when the media lags", () => {
	let clock = startPlayheadClock(0, 0);
	clock = tickPlayheadClock(clock, 0, 200, 1);
	clock = tickPlayheadClock(clock, 0, 300, 1);
	assert.equal(clock.shown, 0.2);
	clock = tickPlayheadClock(clock, 0.05, 350, 1);
	assert.equal(clock.shown, 0.2);
	clock = tickPlayheadClock(clock, 0.3, 600, 1);
	assert.ok(clock.shown > 0.2);
});

test("jumps ahead with a forward seek", () => {
	let clock = startPlayheadClock(1, 0);
	clock = tickPlayheadClock(clock, 4, 16, 1);
	assert.equal(clock.shown, 4);
});

test("starts over when the clip loops or seeks back", () => {
	let clock = startPlayheadClock(0, 0);
	clock = tickPlayheadClock(clock, 2.9, 2900, 1);
	clock = tickPlayheadClock(clock, 0.01, 2916, 1);
	assert.equal(clock.shown, 0.01);
	clock = tickPlayheadClock(clock, 0.01, 2932, 1);
	assert.ok(clock.shown > 0.01 && clock.shown < 0.05);
});

test("follows the playback rate", () => {
	let clock = startPlayheadClock(0, 0);
	clock = tickPlayheadClock(clock, 0, 100, 2);
	assert.equal(clock.shown, 0.2);
});
