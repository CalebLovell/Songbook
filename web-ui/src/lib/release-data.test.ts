import assert from "node:assert/strict";
import { test } from "node:test";

import {
	newerRelease,
	RELOAD_WHEN_IDLE_MS,
	safeToReload,
} from "./release-data.ts";

test("a page from an older release learns the station moved on", () => {
	assert.equal(newerRelease("v1.1.0", "v1.2.0"), "v1.2.0");
	assert.equal(newerRelease("v1.2.0", "v1.2.0"), null);
});

test("a build without a release number never reloads", () => {
	assert.equal(newerRelease(null, "v1.2.0"), null);
	assert.equal(newerRelease("v1.2.0", null), null);
});

const quiet = { hidden: false, idleMs: 0, playing: false, editing: false };

test("a tab nobody is looking at reloads straight away", () => {
	assert.equal(safeToReload({ ...quiet, hidden: true }), true);
});

test("a visible tab waits until it has sat untouched", () => {
	assert.equal(safeToReload(quiet), false);
	assert.equal(safeToReload({ ...quiet, idleMs: RELOAD_WHEN_IDLE_MS }), true);
});

test("playing audio or a field being typed in holds the reload", () => {
	const idle = { ...quiet, hidden: true, idleMs: RELOAD_WHEN_IDLE_MS };
	assert.equal(safeToReload({ ...idle, playing: true }), false);
	assert.equal(safeToReload({ ...idle, editing: true }), false);
});
