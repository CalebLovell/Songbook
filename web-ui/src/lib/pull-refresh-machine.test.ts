import assert from "node:assert/strict";
import { test } from "node:test";

import {
	INITIAL_PULL_STATE,
	PULL_THRESHOLD,
	type PullEvent,
	type PullState,
	pullTransition,
} from "~/lib/pull-refresh-machine.ts";

const touch = (fingers = 1, atTop = true): PullEvent => ({
	type: "touchStart",
	point: { x: 100, y: 100 },
	fingers,
	atTop,
});
const moveTo = (y: number, x = 100): PullEvent => ({
	type: "touchMove",
	point: { x, y },
});
const FAR = 100 + (PULL_THRESHOLD + 10) * 2;
const NEAR = 100 + (PULL_THRESHOLD - 10) * 2;

function run(...events: PullEvent[]): PullState {
	return events.reduce(pullTransition, INITIAL_PULL_STATE);
}

test("a touch only tracks with one finger at the top of the page", () => {
	assert.equal(run(touch()).phase, "tracking");
	assert.equal(run(touch(2)).phase, "idle");
	assert.equal(run(touch(1, false)).phase, "idle");
});

test("moving up or sideways gives the gesture back to the page", () => {
	assert.equal(run(touch(), moveTo(90)).phase, "idle");
	assert.equal(run(touch(), moveTo(110, 200)).phase, "idle");
});

test("a tap never shows the indicator", () => {
	assert.equal(run(touch(), { type: "touchEnd" }).phase, "idle");
});

test("pulling tracks distance with resistance and a limit", () => {
	assert.equal(run(touch(), moveTo(140)).pull, 20);
	assert.equal(run(touch(), moveTo(5000)).pull, 96);
});

test("letting go short of the threshold settles without refreshing", () => {
	const state = run(touch(), moveTo(NEAR), { type: "touchEnd" });
	assert.equal(state.phase, "settling");
	assert.equal(state.pull, 0);
});

test("letting go past the threshold refreshes", () => {
	assert.equal(
		run(touch(), moveTo(FAR), { type: "touchEnd" }).phase,
		"refreshing",
	);
});

test("a second finger during a pull abandons it and pulling works again", () => {
	const abandoned = run(touch(), moveTo(FAR), touch(2));
	assert.equal(abandoned.phase, "settling");
	assert.equal(abandoned.pull, 0);

	const afterFingersLift = [
		{ type: "touchEnd" },
		{ type: "touchEnd" },
		{ type: "settled" },
	] satisfies PullEvent[];
	const idle = afterFingersLift.reduce(pullTransition, abandoned);
	assert.equal(idle.phase, "idle");
	assert.equal(pullTransition(idle, touch()).phase, "tracking");
});

test("a cancelled touch past the threshold doesn't refresh", () => {
	const state = run(touch(), moveTo(FAR), { type: "touchCancel" });
	assert.equal(state.phase, "settling");
});

test("new touches are ignored until the refresh has settled", () => {
	const refreshing = run(touch(), moveTo(FAR), { type: "touchEnd" });
	assert.equal(pullTransition(refreshing, touch()), refreshing);

	const settling = pullTransition(refreshing, { type: "refreshDone" });
	assert.equal(settling.phase, "settling");
	assert.equal(pullTransition(settling, touch()), settling);
	assert.equal(pullTransition(settling, { type: "settled" }).phase, "idle");
});
