import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSpan, healthAttention, healthCards } from "./health-cards.ts";
import type { StationChecks, StationHealth } from "./health-data.ts";
import type { UpdateState } from "./updates-data.ts";

const NOW = Date.parse("2026-11-10T12:00:00Z");

const UP_TO_DATE: UpdateState = {
	managed: true,
	installed: { version: "v1.42.0", installedAt: "2026-11-01T03:00:00Z" },
	latest: { version: "v1.42.0" },
	checkedAt: "2026-11-10T09:00:00Z",
	state: "idle",
	message: null,
	target: null,
};

function cardsOf(
	view: StationHealth,
	updates: UpdateState | null = UP_TO_DATE,
) {
	return healthCards(view, updates, NOW);
}

const HEALTHY_CHECKS: StationChecks = {
	uptimeSeconds: 6 * 86_400,
	audio: { state: "healthy", ageSeconds: 14, source: "microphone" },
	analyzer: {
		state: "healthy",
		runningSeconds: 3 * 86_400 + 4 * 3_600,
		model: "BirdNET 2.4",
	},
	name: { state: "healthy", name: "Backyard Station" },
	location: {
		state: "healthy",
		latitude: 41.881,
		longitude: -87.627,
		timezone: "America/Chicago",
	},
	power: { state: "steady" },
	backups: { ageSeconds: 13 * 86_400 },
	storage: {
		state: "healthy",
		usedPercent: 61.2,
		freeBytes: 41 * 1024 ** 3,
		threshold: 85,
		action: "purge",
	},
};

function health(
	checks: Partial<StationChecks>,
	extra: Partial<StationHealth> = {},
): StationHealth {
	return {
		diskUsedPercent: 61.2,
		toDos: [],
		checks: { ...HEALTHY_CHECKS, ...checks },
		settingUp: false,
		...extra,
	};
}

function card(view: StationHealth, id: string) {
	const found = cardsOf(view).find((each) => each.id === id);
	assert.ok(found, `${id} card missing`);
	return found;
}

test("a healthy station keeps every card green and says so", () => {
	const view = health({});
	const cards = cardsOf(view);
	assert.deepEqual(
		cards.map((each) => each.title),
		[
			"Name",
			"Location",
			"Audio input",
			"Power supply",
			"BirdNET model",
			"Storage",
			"Updates",
			"Backups",
		],
	);
	assert.ok(cards.every((each) => each.tone === "ok"));
	assert.equal(healthAttention(cards), null);
	assert.equal(card(view, "storage").figure, "62% used · 41.0 GB free");
	assert.equal(
		card(view, "model").details[0],
		"BirdNET 2.4 is checking every recording for birds.",
	);
});

test("the location card gives its time zone", () => {
	const location = card(health({}), "location");
	assert.equal(location.figure, "41.8810, −87.6270");
	assert.deepEqual(location.details, ["Time zone America/Chicago."]);
});

test("a broken check carries its own problem and fix", () => {
	const view = health(
		{
			audio: { state: "failing", ageSeconds: 1_080, source: "microphone" },
			storage: { ...HEALTHY_CHECKS.storage, state: "failing", usedPercent: 88 },
		},
		{
			toDos: [
				{ kind: "audio" },
				{ kind: "disk", usedPercent: 88, threshold: 85, action: "purge" },
			],
		},
	);
	const audio = card(view, "audio");
	assert.equal(audio.tone, "problem");
	assert.equal(audio.problem?.title, "No audio is arriving");
	assert.deepEqual(audio.actions, [
		{
			kind: "setting",
			tab: "audio-input",
			label: "Check audio input",
			primary: true,
		},
	]);
	assert.equal(card(view, "storage").problem?.title, "The disk is nearly full");
	assert.deepEqual(healthAttention(cardsOf(view)), {
		count: 2,
		broken: true,
		label: "2 need a look",
	});
});

test("a stopped model makes Restart BirdNET the primary action", () => {
	const view = health({
		analyzer: { state: "failing", runningSeconds: null, model: null },
	});
	const model = card(view, "model");
	assert.equal(model.problem?.title, "Bird analysis has stopped");
	assert.deepEqual(model.actions, [{ kind: "restart-birdnet", primary: true }]);
	assert.deepEqual(card(health({}), "model").actions, [
		{ kind: "restart-birdnet", primary: false },
	]);
});

test("a new station shows set-up cards, not problems", () => {
	const view = health(
		{
			name: { state: "failing", name: "raspberrypi" },
			location: {
				state: "failing",
				latitude: 0,
				longitude: 0,
				timezone: "America/Chicago",
			},
			backups: { ageSeconds: null },
		},
		{ settingUp: true, toDos: [{ kind: "location" }, { kind: "name" }] },
	);
	const cards = cardsOf(view);
	assert.equal(card(view, "name").tone, "setup");
	assert.equal(card(view, "backups").tone, "setup");
	assert.ok(cards.every((each) => each.tone !== "problem"));
	assert.deepEqual(healthAttention(cards), {
		count: 3,
		broken: false,
		label: "3 need a look",
	});
});

test("a power dip warns without counting as a problem", () => {
	const view = health({ power: { state: "dipped" } });
	assert.equal(card(view, "power").tone, "warning");
	assert.equal(card(view, "power").problem?.title, "The power supply dipped");
	assert.deepEqual(healthAttention(cardsOf(view)), {
		count: 1,
		broken: false,
		label: "1 needs a look",
	});
});

test("unreadable checks and a missing backup are counted apart", () => {
	const view = health({
		power: { state: "unknown" },
		backups: { ageSeconds: null },
	});
	assert.equal(card(view, "power").figure, "Not known");
	assert.equal(card(view, "backups").figure, "No backup yet");
	assert.equal(healthAttention(cardsOf(view))?.count, 1);
});

test("spans read naturally", () => {
	assert.equal(formatSpan(30), "under a minute");
	assert.equal(formatSpan(12 * 60), "12 minutes");
	assert.equal(formatSpan(3 * 86_400 + 4 * 3_600), "3 days, 4 hours");
	assert.equal(formatSpan(86_400), "1 day");
});

test("an offered update warns and offers Install", () => {
	const updates = cardsOf(health({}), {
		...UP_TO_DATE,
		latest: { version: "v1.43.0" },
	}).find((each) => each.id === "updates");
	assert.equal(updates?.tone, "warning");
	assert.equal(updates?.problem?.title, "Songbook v1.43.0 is out");
	assert.deepEqual(updates?.actions, [
		{ kind: "install-update", version: "v1.43.0" },
	]);
});

test("an up-to-date station says when it last checked", () => {
	const updates = cardsOf(health({})).find((each) => each.id === "updates");
	assert.equal(updates?.figure, "Songbook v1.42.0");
	assert.deepEqual(updates?.details, ["Up to date. Checked 3 hours ago."]);
});

test("name and location are changed on Health itself", () => {
	assert.deepEqual(card(health({}), "name").actions, [
		{ kind: "edit-name", primary: false },
	]);
	assert.deepEqual(
		card(
			health({
				location: {
					state: "failing",
					latitude: 0,
					longitude: 0,
					timezone: null,
				},
			}),
			"location",
		).actions,
		[{ kind: "edit-location", primary: true }],
	);
	assert.deepEqual(card(health({}), "backups").actions, [
		{ kind: "download-backup" },
	]);
});

test("only a release install offers the automatic-updates choice", () => {
	const managed = cardsOf(health({})).find((each) => each.id === "updates");
	assert.equal(managed?.automaticUpdates, true);
	const development = healthCards(health({}), {
		...UP_TO_DATE,
		managed: false,
	}).find((each) => each.id === "updates");
	assert.equal(development?.automaticUpdates, undefined);
});
