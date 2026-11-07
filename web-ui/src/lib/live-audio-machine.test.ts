import assert from "node:assert/strict";
import { test } from "node:test";

import {
	INITIAL_LIVE_AUDIO_STATE,
	type LiveAudioEvent,
	type LiveAudioState,
	liveAudioIsConnecting,
	liveAudioIsPlaying,
	liveAudioReadout,
	liveAudioTransition,
} from "~/lib/live-audio-machine.ts";

function run(...events: LiveAudioEvent["type"][]): LiveAudioState {
	return events.reduce<LiveAudioState>(
		(state, type) => liveAudioTransition(state, { type }),
		INITIAL_LIVE_AUDIO_STATE,
	);
}

test("listening connects, then plays", () => {
	assert.equal(run("listen").status, "connecting");
	assert.equal(run("listen", "mediaPlaying").status, "playing");
});

test("a failed connection shows as connecting until the failure is shown", () => {
	const failing = run("listen", "failed");
	assert.equal(failing.status, "failing");
	assert.equal(liveAudioIsConnecting(failing), true);
	const offline = liveAudioTransition(failing, { type: "failureShown" });
	assert.deepEqual(offline, { status: "offline", hasFailed: true });
});

test("a connection that never answers times out", () => {
	const offline = run("listen", "connectTimedOut", "failureShown");
	assert.equal(offline.status, "offline");
});

test("sound arriving during the failure delay wins", () => {
	assert.deepEqual(run("listen", "failed", "mediaPlaying"), {
		status: "playing",
		hasFailed: false,
	});
});

test("a pause that comes from a cancelled connection doesn't read as paused", () => {
	assert.equal(run("listen", "mediaPaused").status, "connecting");
});

test("a retry says so, and sound clears the failure", () => {
	const retrying = run("listen", "failed", "failureShown", "listen");
	assert.equal(liveAudioReadout(retrying), "Retrying…");
	const playing = liveAudioTransition(retrying, { type: "mediaPlaying" });
	assert.equal(playing.hasFailed, false);
});

test("a drop in the stream reads as buffering, not live", () => {
	const stalled = run("listen", "mediaPlaying", "mediaWaiting");
	assert.equal(stalled.status, "stalled");
	assert.equal(liveAudioReadout(stalled), "Buffering…");
	assert.equal(liveAudioIsPlaying(stalled), true);
});

test("the stream can recover from a stall", () => {
	const recovered = run(
		"listen",
		"mediaPlaying",
		"mediaWaiting",
		"mediaPlaying",
	);
	assert.equal(recovered.status, "playing");
});

test("a stall that lasts goes offline", () => {
	const offline = run(
		"listen",
		"mediaPlaying",
		"mediaWaiting",
		"stallTimedOut",
	);
	assert.deepEqual(offline, { status: "offline", hasFailed: true });
});

test("the listener can pause during a stall", () => {
	const paused = run("listen", "mediaPlaying", "mediaWaiting", "mediaPaused");
	assert.equal(paused.status, "paused");
});

test("waiting events can't start a connection nobody asked for", () => {
	assert.equal(run("mediaWaiting").status, "idle");
	assert.equal(
		run("listen", "mediaPlaying", "mediaPaused", "mediaWaiting").status,
		"paused",
	);
	assert.equal(
		run("listen", "failed", "failureShown", "mediaWaiting").status,
		"offline",
	);
});

test("a late failure from a finished attempt doesn't disturb a pause", () => {
	const paused = run("listen", "mediaPlaying", "mediaPaused", "failed");
	assert.equal(paused.status, "paused");
});
