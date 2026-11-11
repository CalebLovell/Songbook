import assert from "node:assert/strict";
import { test } from "node:test";

import {
	audioStaleAfterSeconds,
	BOOT_GRACE_SECONDS,
	checkAnalyzer,
	checkAudio,
	checkDisk,
	checkLocation,
	checkName,
	checkPower,
	describeToDo,
	dfUsedPercent,
	formatModelName,
	parseThrottled,
	type StationReadings,
	stationToDos,
} from "./health-data.ts";

const NOW = 1_800_000_000_000;
const SETTLED = BOOT_GRACE_SECONDS + 1;

const HEALTHY: StationReadings = {
	nowMs: NOW,
	uptimeSeconds: SETTLED,
	audioChangedMs: NOW - 10_000,
	recordingLengthSeconds: 15,
	analyzer: { loadState: "loaded", activeState: "active" },
	latitude: "45.5",
	longitude: "-75.1",
	siteName: "Backyard Station",
	hostname: "birdnetpi",
	diskUsedPercent: 45,
	purgeThreshold: 95,
	fullDiskAction: "purge",
};

test("audio is healthy while the folder keeps changing", () => {
	assert.equal(checkAudio(HEALTHY), "healthy");
});

test("audio fails once the folder goes quiet past the limit", () => {
	assert.equal(
		checkAudio({ ...HEALTHY, audioChangedMs: NOW - 301_000 }),
		"failing",
	);
});

test("a long recording length earns a longer wait before audio fails", () => {
	assert.equal(audioStaleAfterSeconds(15), 300);
	assert.equal(audioStaleAfterSeconds(60), 360);
	assert.equal(
		checkAudio({
			...HEALTHY,
			audioChangedMs: NOW - 330_000,
			recordingLengthSeconds: 60,
		}),
		"healthy",
	);
	assert.equal(
		checkAudio({
			...HEALTHY,
			audioChangedMs: NOW - 361_000,
			recordingLengthSeconds: 60,
		}),
		"failing",
	);
});

test("audio is unknown with no folder to read", () => {
	assert.equal(checkAudio({ ...HEALTHY, audioChangedMs: null }), "unknown");
});

test("audio is unknown during the boot grace period", () => {
	assert.equal(
		checkAudio({
			...HEALTHY,
			audioChangedMs: NOW - 3_600_000,
			uptimeSeconds: BOOT_GRACE_SECONDS - 1,
		}),
		"unknown",
	);
});

test("a folder dated ahead of the clock counts as healthy", () => {
	assert.equal(
		checkAudio({ ...HEALTHY, audioChangedMs: NOW + 60_000 }),
		"healthy",
	);
});

test("the analyzer is healthy when active", () => {
	assert.equal(checkAnalyzer(HEALTHY), "healthy");
});

test("the analyzer fails when stopped or failed", () => {
	for (const activeState of ["inactive", "failed"]) {
		assert.equal(
			checkAnalyzer({
				...HEALTHY,
				analyzer: { loadState: "loaded", activeState },
			}),
			"failing",
		);
	}
});

test("the analyzer is unknown without systemctl", () => {
	assert.equal(checkAnalyzer({ ...HEALTHY, analyzer: null }), "unknown");
});

test("the analyzer is unknown when the unit isn't installed", () => {
	assert.equal(
		checkAnalyzer({
			...HEALTHY,
			analyzer: { loadState: "not-found", activeState: "inactive" },
		}),
		"unknown",
	);
});

test("the analyzer is unknown mid-restart", () => {
	for (const activeState of ["activating", "deactivating", "reloading"]) {
		assert.equal(
			checkAnalyzer({
				...HEALTHY,
				analyzer: { loadState: "loaded", activeState },
			}),
			"unknown",
		);
	}
});

test("the analyzer is unknown during the boot grace period", () => {
	assert.equal(
		checkAnalyzer({
			...HEALTHY,
			analyzer: { loadState: "loaded", activeState: "inactive" },
			uptimeSeconds: 10,
		}),
		"unknown",
	);
});

test("location is healthy when either coordinate is set", () => {
	assert.equal(checkLocation(HEALTHY), "healthy");
	assert.equal(checkLocation({ latitude: "0", longitude: "-75.1" }), "healthy");
	assert.equal(checkLocation({ latitude: "45.5", longitude: "0" }), "healthy");
});

test("location fails when both coordinates are zero, however written", () => {
	assert.equal(checkLocation({ latitude: "0", longitude: "0" }), "failing");
	assert.equal(
		checkLocation({ latitude: "0.0000", longitude: "0.0000" }),
		"failing",
	);
});

test("location is unknown when the config doesn't say", () => {
	assert.equal(
		checkLocation({ latitude: undefined, longitude: undefined }),
		"unknown",
	);
	assert.equal(checkLocation({ latitude: "north", longitude: "0" }), "unknown");
});

test("the name is healthy once it differs from the hostname", () => {
	assert.equal(checkName(HEALTHY), "healthy");
});

test("the name is still to do when empty or the installer's hostname", () => {
	assert.equal(checkName({ ...HEALTHY, siteName: "  " }), "failing");
	assert.equal(checkName({ ...HEALTHY, siteName: "birdnetpi" }), "failing");
	assert.equal(checkName({ ...HEALTHY, siteName: "BirdNetPi " }), "failing");
});

test("the name is unknown when the config doesn't say", () => {
	assert.equal(checkName({ ...HEALTHY, siteName: undefined }), "unknown");
});

test("the disk figure follows df, leaving root's reserve out of both sides", () => {
	assert.equal(
		dfUsedPercent({ blocks: 100, bfree: 55, bavail: 50 }),
		47.368421052631575,
	);
	assert.equal(dfUsedPercent({ blocks: 0, bfree: 0, bavail: 0 }), null);
});

test("a purging disk may sit at its threshold without alarm", () => {
	assert.equal(checkDisk({ ...HEALTHY, diskUsedPercent: 94.2 }), "healthy");
	assert.equal(checkDisk({ ...HEALTHY, diskUsedPercent: 96 }), "healthy");
});

test("a purging disk fails once it runs past its threshold", () => {
	assert.equal(checkDisk({ ...HEALTHY, diskUsedPercent: 96.5 }), "failing");
});

test("a purging disk at the top threshold still alarms", () => {
	assert.equal(
		checkDisk({ ...HEALTHY, purgeThreshold: 99, diskUsedPercent: 98.5 }),
		"failing",
	);
});

test("a keeping disk warns before services stop", () => {
	const keep = { ...HEALTHY, fullDiskAction: "keep" as const };
	assert.equal(checkDisk({ ...keep, diskUsedPercent: 89 }), "healthy");
	assert.equal(checkDisk({ ...keep, diskUsedPercent: 90 }), "failing");
});

test("the disk is unknown without a figure or a threshold", () => {
	assert.equal(checkDisk({ ...HEALTHY, diskUsedPercent: null }), "unknown");
	assert.equal(checkDisk({ ...HEALTHY, purgeThreshold: null }), "unknown");
});

test("a healthy station has nothing to do", () => {
	assert.deepEqual(stationToDos(HEALTHY), []);
});

test("unknown readings never count as to-dos", () => {
	assert.deepEqual(
		stationToDos({
			...HEALTHY,
			audioChangedMs: null,
			analyzer: null,
			latitude: undefined,
			longitude: undefined,
			siteName: undefined,
			diskUsedPercent: null,
			purgeThreshold: null,
		}),
		[],
	);
});

test("every failing check is listed", () => {
	const toDos = stationToDos({
		...HEALTHY,
		audioChangedMs: NOW - 3_600_000,
		analyzer: { loadState: "loaded", activeState: "failed" },
		latitude: "0",
		longitude: "0",
		siteName: "",
		diskUsedPercent: 98.2,
	});
	assert.deepEqual(toDos, [
		{ kind: "location" },
		{ kind: "audio" },
		{ kind: "analyzer" },
		{ kind: "disk", usedPercent: 99, threshold: 95, action: "purge" },
		{ kind: "name" },
	]);
});

test("a keeping disk names the line where recording stops", () => {
	const disk = describeToDo({
		kind: "disk",
		usedPercent: 91,
		threshold: 95,
		action: "keep",
	});
	assert.match(disk.detail, /91%/);
	assert.match(disk.detail, /stops recording at 95%/);
});

test("vcgencmd's throttle bits become power now and since boot", () => {
	assert.deepEqual(parseThrottled("throttled=0x0\n"), {
		now: false,
		sinceBoot: false,
	});
	assert.deepEqual(parseThrottled("throttled=0x50005\n"), {
		now: true,
		sinceBoot: true,
	});
	assert.deepEqual(parseThrottled("throttled=0x50000\n"), {
		now: false,
		sinceBoot: true,
	});
	assert.equal(parseThrottled("error"), null);
});

test("power is low now before it dipped earlier", () => {
	assert.equal(checkPower(null), "unknown");
	assert.equal(checkPower({ now: false, sinceBoot: false }), "steady");
	assert.equal(checkPower({ now: false, sinceBoot: true }), "dipped");
	assert.equal(checkPower({ now: true, sinceBoot: true }), "low");
});

test("BirdNET-Pi's model file reads as a model name", () => {
	assert.equal(
		formatModelName("BirdNET_GLOBAL_6K_V2.4_Model_FP16"),
		"BirdNET 2.4",
	);
	assert.equal(
		formatModelName("BirdNET_6K_GLOBAL_MODEL"),
		"BirdNET 6K GLOBAL MODEL",
	);
	assert.equal(formatModelName(undefined), null);
});
