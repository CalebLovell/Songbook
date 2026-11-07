import assert from "node:assert/strict";
import { test } from "node:test";

import {
	availableUpdate,
	parseUpdateState,
	updateBusy,
} from "./updates-data.ts";

const installed = JSON.stringify({
	version: "v1.2.0",
	commit: "abc",
	installedAt: "2026-10-01T03:12:00Z",
});

test("reads what the updater wrote", () => {
	const state = parseUpdateState(
		installed,
		JSON.stringify({
			state: "idle",
			message: "Version v1.3.0 is available.",
			latest: { version: "v1.3.0" },
			checkedAt: "2026-10-12T03:40:00Z",
		}),
	);
	assert.deepEqual(state, {
		managed: true,
		installed: {
			version: "v1.2.0",
			installedAt: "2026-10-01T03:12:00Z",
		},
		latest: { version: "v1.3.0" },
		checkedAt: "2026-10-12T03:40:00Z",
		state: "idle",
		message: "Version v1.3.0 is available.",
		target: null,
	});
	assert.equal(availableUpdate(state), "v1.3.0");
	assert.equal(updateBusy(state), false);
});

test("a station that has never checked has nothing on offer", () => {
	const state = parseUpdateState(installed, null);
	assert.equal(state.latest, null);
	assert.equal(state.state, "idle");
	assert.equal(availableUpdate(state), null);
});

test("the installed release is not offered again", () => {
	const state = parseUpdateState(
		installed,
		JSON.stringify({ latest: { version: "v1.2.0" } }),
	);
	assert.equal(availableUpdate(state), null);
});

test("an update in progress names its target and holds the buttons", () => {
	const state = parseUpdateState(
		installed,
		JSON.stringify({ state: "updating", target: "v1.3.0" }),
	);
	assert.equal(state.target, "v1.3.0");
	assert.equal(updateBusy(state), true);
});

test("an update whose status stopped moving reads as interrupted", () => {
	const status = JSON.stringify({
		state: "updating",
		target: "v1.3.0",
		updatedAt: "2026-10-12T03:00:00Z",
	});
	const soon = Date.parse("2026-10-12T03:20:00Z");
	const later = Date.parse("2026-10-12T03:31:00Z");

	assert.equal(parseUpdateState(installed, status, soon).state, "updating");

	const stuck = parseUpdateState(installed, status, later);
	assert.equal(stuck.state, "failed");
	assert.equal(stuck.target, null);
	assert.match(stuck.message ?? "", /stopped before it finished/);
	assert.equal(updateBusy(stuck), false);
});

test("a finished state never reads as interrupted, however old", () => {
	const status = JSON.stringify({
		state: "updated",
		updatedAt: "2026-01-01T00:00:00Z",
	});
	assert.equal(parseUpdateState(installed, status).state, "updated");
});

test("garbage and unknown states read as unknown, never as a crash", () => {
	const state = parseUpdateState("{not json", '{"state":"exploding"}');
	assert.equal(state.installed, null);
	assert.equal(state.state, "idle");
	assert.equal(parseUpdateState("[]", "null").installed, null);
});
