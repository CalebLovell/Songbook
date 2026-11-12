import assert from "node:assert/strict";
import test from "node:test";

import {
	type ClipEvent,
	type ClipStatus,
	clipAwaitsFirstSound,
	clipShowsPlayhead,
	clipTransition,
	INITIAL_CLIP_STATE,
} from "~/lib/clip-player-machine.ts";

function walk(...types: ClipEvent["type"][]): ClipStatus[] {
	let state = INITIAL_CLIP_STATE;
	return types.map((type) => {
		state = clipTransition(state, { type } as ClipEvent);
		return state.status;
	});
}

test("pressing play loads the clip, then waits for sound before playing", () => {
	assert.deepEqual(walk("toggle", "loaded", "mediaPlaying"), [
		"loading",
		"starting",
		"playing",
	]);
});

test("pressing pause before the first sound stops it starting", () => {
	assert.deepEqual(walk("toggle", "loaded", "toggle"), [
		"loading",
		"starting",
		"paused",
	]);
});

test("the button waits only for the clip's first sound", () => {
	let state = INITIAL_CLIP_STATE;
	const steps: ClipEvent["type"][] = [
		"toggle",
		"loaded",
		"mediaPlaying",
		"toggle",
		"toggle",
	];
	const waits = steps.map((type) => {
		state = clipTransition(state, { type } as ClipEvent);
		return clipAwaitsFirstSound(state);
	});
	assert.deepEqual(waits, [true, true, false, false, false]);
});

test("a second press while loading means don't play after all", () => {
	assert.deepEqual(walk("toggle", "toggle", "loaded"), [
		"loading",
		"loading",
		"paused",
	]);
});

test("play, pause, play", () => {
	assert.deepEqual(
		walk(
			"toggle",
			"loaded",
			"mediaPlaying",
			"toggle",
			"toggle",
			"mediaPlaying",
		),
		["loading", "starting", "playing", "paused", "starting", "playing"],
	);
});

test("dragging while playing pauses for the drag and resumes on release", () => {
	assert.deepEqual(
		walk(
			"toggle",
			"loaded",
			"mediaPlaying",
			"scrubStart",
			"mediaPaused",
			"scrubEnd",
		),
		["loading", "starting", "playing", "scrubbing", "scrubbing", "starting"],
	);
});

test("dragging while paused stays paused on release", () => {
	assert.deepEqual(
		walk("toggle", "loaded", "toggle", "scrubStart", "scrubEnd", "toggle"),
		["loading", "starting", "paused", "scrubbing", "paused", "starting"],
	);
});

test("dragging before anything has loaded loads, then lands paused", () => {
	assert.deepEqual(walk("scrubStart", "loaded", "scrubEnd"), [
		"loading",
		"scrubbing",
		"paused",
	]);
	assert.deepEqual(walk("scrubStart", "scrubEnd", "loaded"), [
		"loading",
		"loading",
		"paused",
	]);
});

test("dragging to the end mid-drag doesn't end the clip", () => {
	assert.deepEqual(
		walk("toggle", "loaded", "scrubStart", "mediaEnded", "scrubEnd"),
		["loading", "starting", "scrubbing", "scrubbing", "starting"],
	);
});

test("a clip that runs out ends, and play starts it again", () => {
	assert.deepEqual(
		walk("toggle", "loaded", "mediaPlaying", "mediaEnded", "toggle"),
		["loading", "starting", "playing", "ended", "starting"],
	);
});

test("another clip starting elsewhere pauses this one", () => {
	assert.deepEqual(walk("toggle", "loaded", "mediaPlaying", "mediaPaused"), [
		"loading",
		"starting",
		"playing",
		"paused",
	]);
});

test("a failed load can be retried", () => {
	assert.deepEqual(walk("toggle", "loadFailed", "toggle", "loaded"), [
		"loading",
		"error",
		"loading",
		"starting",
	]);
});

test("the playhead shows once there's a position to show", () => {
	let state = INITIAL_CLIP_STATE;
	assert.equal(clipShowsPlayhead(state), false);
	state = clipTransition(state, { type: "scrubStart" });
	assert.equal(clipShowsPlayhead(state), true);
	state = clipTransition(state, { type: "loaded" });
	state = clipTransition(state, { type: "scrubEnd" });
	assert.equal(clipShowsPlayhead(state), true);
	state = clipTransition(state, { type: "toggle" });
	state = clipTransition(state, { type: "mediaEnded" });
	assert.equal(clipShowsPlayhead(state), false);
});
