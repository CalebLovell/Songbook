import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
	loadSettingsPageData,
	resetSettings,
	restartStation,
	saveDetectionSettings,
	saveReviewSettings,
} from "./settings.server.ts";

const withPrivacy = (privacyThreshold: number) => ({
	confidence: 0.7,
	sensitivity: 1.25,
	overlap: 0,
	privacyThreshold,
});

async function fixtureConfig(contents: string) {
	const directory = await mkdtemp(
		path.join(tmpdir(), "birdnet-settings-save-"),
	);
	const file = path.join(directory, "birdnet.conf");
	await writeFile(file, contents, "utf8");
	return { directory, file };
}

test("invalid settings neither write configuration nor run commands", async () => {
	const { file } = await fixtureConfig("PRIVACY_THRESHOLD=0\n");
	let commands = 0;
	await assert.rejects(
		saveDetectionSettings(withPrivacy(4), {
			settingsPath: file,
			runner: async () => {
				commands++;
			},
		}),
	);
	assert.equal(await readFile(file, "utf8"), "PRIVACY_THRESHOLD=0\n");
	assert.equal(commands, 0);
});

test("a failed restart leaves saved values and reports partial success", async () => {
	const { file } = await fixtureConfig("PRIVACY_THRESHOLD=0\n");
	const result = await saveDetectionSettings(withPrivacy(2), {
		settingsPath: file,
		runner: async () => {
			throw new Error("systemctl exposed output");
		},
	});
	assert.match(await readFile(file, "utf8"), /^PRIVACY_THRESHOLD=2$/m);
	assert.equal(result.status, "saved-action-failed");
	assert.equal(result.values.privacyThreshold, 2);
	assert.doesNotMatch(result.message, /systemctl exposed output/);
});

test("development skip is explicit while no-action cards save normally", async () => {
	const privacy = await fixtureConfig("PRIVACY_THRESHOLD=0\n");
	const skipped = await saveDetectionSettings(withPrivacy(1), {
		settingsPath: privacy.file,
		skipSystemActions: true,
	});
	assert.equal(skipped.status, "saved-restart-skipped");

	const review = await fixtureConfig("REVIEW_RARE_SPECIES_MAX=10\n");
	const saved = await saveReviewSettings(
		{ rareSpeciesMax: 12 },
		{ settingsPath: review.file },
	);
	assert.equal(saved.status, "saved");
});

test("loads normalized configuration", async () => {
	const { file } = await fixtureConfig(
		[
			'SITE_NAME="Backyard"',
			"LATITUDE=41.1",
			"LONGITUDE=-93.2",
			"MODEL=BirdNET_GLOBAL_6K_V2.4_Model_FP16",
			"DATA_MODEL_VERSION=1",
			"SF_THRESH=0.03",
			"CONFIDENCE=0.7",
			"SENSITIVITY=1.25",
			"OVERLAP=0",
			"PRIVACY_THRESHOLD=0",
			"REC_CARD=default",
			"CHANNELS=2",
			"RTSP_STREAM=",
			"RTSP_STREAM_TO_LIVESTREAM=0",
			"RECORDING_LENGTH=15",
			"EXTRACTION_LENGTH=",
			"AUDIOFMT=mp3",
			"FULL_DISK=purge",
			"PURGE_THRESHOLD=95",
			"MAX_FILES_SPECIES=0",
		].join("\n"),
	);
	const page = await loadSettingsPageData({
		settingsPath: file,
		currentTimezone: "America/Chicago",
	});
	assert.equal(page.station.siteName, "Backyard");
	assert.equal(page.station.timezone, "America/Chicago");
	assert.ok(page.supportedTimezones.includes("America/Chicago"));
	assert.equal(page.review.rareSpeciesMax, 10);
});

test("loads with defaults in place of out-of-range values", async () => {
	const { file } = await fixtureConfig(
		[
			'SITE_NAME="Backyard"',
			"LATITUDE=41.1",
			"LONGITUDE=-93.2",
			"CONFIDENCE=0",
			"SENSITIVITY=2",
			"OVERLAP=1.5",
			"PRIVACY_THRESHOLD=5",
			"HIGHLIGHT_RARE_MAX=0",
			"HIGHLIGHT_RETURNED_DAYS=30",
			"REVIEW_RARE_SPECIES_MAX=0",
		].join("\n"),
	);
	const page = await loadSettingsPageData({
		settingsPath: file,
		currentTimezone: "America/Chicago",
	});
	assert.deepEqual(page.detection, {
		confidence: 0.7,
		sensitivity: 1.25,
		overlap: 1.5,
		privacyThreshold: 0,
	});
	assert.equal(page.highlights.rareMax, 5);
	assert.equal(page.highlights.returnedDays, 30);
	assert.equal(page.review.rareSpeciesMax, 10);
});

test("reset returns every card but Station to its defaults", async () => {
	const { file } = await fixtureConfig(
		[
			'SITE_NAME="Backyard"',
			"LATITUDE=41.1",
			"LONGITUDE=-93.2",
			"MODEL=Perch_v2",
			"DATA_MODEL_VERSION=2",
			"SF_THRESH=0.5",
			"CONFIDENCE=0.95",
			"SENSITIVITY=0.8",
			"OVERLAP=2",
			"PRIVACY_THRESHOLD=2.5",
			"REC_CARD=hw:1,0",
			"CHANNELS=1",
			'RTSP_STREAM="rtsp://camera/live"',
			"RTSP_STREAM_TO_LIVESTREAM=0",
			"RECORDING_LENGTH=30",
			"EXTRACTION_LENGTH=9",
			"AUDIOFMT=flac",
			"FULL_DISK=keep",
			"PURGE_THRESHOLD=40",
			"MAX_FILES_SPECIES=25",
			"REVIEW_RARE_SPECIES_MAX=99",
			"BIRDWEATHER_ID=secret-that-must-survive",
		].join("\n"),
	);
	const result = await resetSettings({
		settingsPath: file,
		skipSystemActions: true,
	});
	assert.equal(result.status, "reset-restart-skipped");

	const page = await loadSettingsPageData({
		settingsPath: file,
		currentTimezone: "America/Chicago",
	});
	assert.deepEqual(page.detection, {
		confidence: 0.7,
		sensitivity: 1.25,
		overlap: 0,
		privacyThreshold: 0,
	});
	assert.deepEqual(page.review, { rareSpeciesMax: 10 });

	assert.equal(page.station.siteName, "Backyard");
	assert.equal(page.station.latitude, 41.1);
	assert.equal(page.station.longitude, -93.2);
	const after = await readFile(file, "utf8");
	assert.match(after, /^BIRDWEATHER_ID=secret-that-must-survive$/m);
	assert.match(after, /^REC_CARD=hw:1,0$/m);
	assert.match(after, /^CHANNELS=1$/m);
	assert.match(after, /^RTSP_STREAM="rtsp:\/\/camera\/live"$/m);
	assert.match(after, /^RECORDING_LENGTH=30$/m);
	assert.match(after, /^EXTRACTION_LENGTH=9$/m);
	assert.match(after, /^AUDIOFMT=flac$/m);
	assert.match(after, /^FULL_DISK=keep$/m);
	assert.match(after, /^PURGE_THRESHOLD=40$/m);
	assert.match(after, /^MAX_FILES_SPECIES=25$/m);
});

test("a config still naming removed models loads and saves", async () => {
	const { file } = await fixtureConfig(
		"DATA_MODEL_VERSION=1\nMODEL=BirdNET_6K_GLOBAL_MODEL\nCONFIDENCE=0.8\n",
	);
	const page = await loadSettingsPageData({
		settingsPath: file,
		currentTimezone: "America/Chicago",
	});
	assert.equal(page.detection.confidence, 0.8);

	const result = await saveDetectionSettings(
		{ ...page.detection, confidence: 0.9 },
		{ settingsPath: file, skipSystemActions: true },
	);
	assert.equal(result.values.confidence, 0.9);
	assert.match(await readFile(file, "utf8"), /^CONFIDENCE=0.9$/m);
});

test("reset restarts each affected service once", async () => {
	const { file } = await fixtureConfig("PRIVACY_THRESHOLD=1\n");
	const commands: string[][] = [];
	const result = await resetSettings({
		settingsPath: file,
		runner: async (executable, args) => {
			commands.push([executable, ...args]);
		},
	});
	assert.equal(result.status, "reset");
	assert.equal(commands.length, 1);
	const services = commands[0].slice(3);
	assert.deepEqual(services, [...new Set(services)]);
	assert.ok(services.includes("birdnet_analysis.service"));
});

test("a failed restart still reports the reset that landed", async () => {
	const { file } = await fixtureConfig("PRIVACY_THRESHOLD=1\n");
	const result = await resetSettings({
		settingsPath: file,
		runner: async () => {
			throw new Error("systemctl exposed output");
		},
	});
	assert.equal(result.status, "reset-action-failed");
	assert.doesNotMatch(result.message, /systemctl exposed output/);
	assert.match(await readFile(file, "utf8"), /^PRIVACY_THRESHOLD=0$/m);
});

test("a save that cannot restart says so in the reader's terms", async () => {
	const { file } = await fixtureConfig("PRIVACY_THRESHOLD=0\n");
	const refused = await saveDetectionSettings(withPrivacy(2), {
		settingsPath: file,
		runner: async () => {
			throw new Error("boom");
		},
	});
	const declined = await saveDetectionSettings(withPrivacy(2), {
		settingsPath: file,
		skipSystemActions: true,
	});
	assert.equal(
		refused.message,
		"Saved. Restart BirdNET for this to take effect.",
	);
	assert.equal(declined.message, refused.message);
	for (const message of [refused.message, declined.message]) {
		assert.doesNotMatch(message, /system action|systemctl|service/i);
	}
});

test("a card with nothing to restart just saves", async () => {
	const { file } = await fixtureConfig("REVIEW_RARE_SPECIES_MAX=10\n");
	const saved = await saveReviewSettings(
		{ rareSpeciesMax: 12 },
		{ settingsPath: file, skipSystemActions: true },
	);
	assert.equal(saved.status, "saved");
	assert.equal(saved.message, "Saved.");
});

test("restart bounces exactly the named card's services", async () => {
	const commands: string[][] = [];
	const result = await restartStation("detection", {
		runner: async (executable, args) => {
			commands.push([executable, ...args]);
		},
	});
	assert.equal(result.status, "restarted");
	assert.deepEqual(commands, [
		["sudo", "systemctl", "restart", "birdnet_analysis.service"],
	]);
});

test("restart without a card brings back the whole set once", async () => {
	const commands: string[][] = [];
	await restartStation(undefined, {
		runner: async (executable, args) => {
			commands.push([executable, ...args]);
		},
	});
	assert.equal(commands.length, 1);
	const services = commands[0].slice(3);
	assert.deepEqual(services, [...new Set(services)]);
});

test("restarting distinguishes nothing to do from a declined restart", async () => {
	let commands = 0;
	const runner = async () => {
		commands++;
	};
	const nothing = await restartStation("review", { runner });
	assert.equal(nothing.status, "nothing-to-restart");
	assert.match(nothing.message, /already live/);

	const declined = await restartStation("detection", {
		runner,
		skipSystemActions: true,
	});
	assert.equal(declined.status, "restart-skipped");
	assert.doesNotMatch(declined.message, /already live/);
	assert.match(declined.message, /next time BirdNET starts/);

	assert.equal(commands, 0);
});

test("a failed restart explains the consequence without exposing systemctl", async () => {
	await assert.rejects(
		restartStation("detection", {
			runner: async () => {
				throw new Error("systemctl exposed output");
			},
		}),
		(error: Error) => {
			assert.doesNotMatch(error.message, /systemctl exposed output/);
			assert.match(error.message, /saved/i);
			return true;
		},
	);
});

test("configuration access errors do not reveal paths", async () => {
	const missing = path.join(
		tmpdir(),
		"birdnet-secret-location",
		"missing.conf",
	);
	await assert.rejects(
		loadSettingsPageData({ settingsPath: missing }),
		(error: Error) => {
			assert.equal(error.message, "BirdNET settings are unavailable.");
			assert.doesNotMatch(error.message, /birdnet-secret-location/);
			return true;
		},
	);
});
