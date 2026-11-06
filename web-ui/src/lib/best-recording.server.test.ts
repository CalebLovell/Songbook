import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
	bestRecordings,
	checkUncheckedRecordings,
	isPublicRecording,
	publicRecordings,
	saveVoiceCheck,
	VOICE_SCORE_LIMIT,
} from "./best-recording.server.ts";

type Row = [
	date: string,
	time: string,
	comName: string,
	confidence: number | null,
	fileName: string,
];

function fixture(rows: Row[], onDisk: string[]) {
	const database = new DatabaseSync(":memory:");
	database.exec(
		"CREATE TABLE detections (Date TEXT, Time TEXT, Sci_Name TEXT, Com_Name TEXT, Confidence REAL, File_Name TEXT)",
	);
	const insert = database.prepare(
		"INSERT INTO detections VALUES (?, ?, ?, ?, ?, ?)",
	);
	const root = mkdtempSync(path.join(tmpdir(), "best-recording-"));
	for (const [date, time, comName, confidence, fileName] of rows) {
		insert.run(date, time, `${comName} sci`, comName, confidence, fileName);
		if (onDisk.includes(fileName)) {
			const dir = path.join(
				root,
				"By_Date",
				date,
				comName.replaceAll(" ", "_"),
			);
			mkdirSync(dir, { recursive: true });
			writeFileSync(path.join(dir, fileName), "");
		}
	}
	return { database, root };
}

test("picks each species' highest-confidence clip", () => {
	const { database, root } = fixture(
		[
			["2026-10-19", "12:00:00", "Blue Jay", 0.8, "recent.wav"],
			["2026-06-30", "06:00:00", "Blue Jay", 0.98, "best.wav"],
			["2026-07-01", "07:00:00", "House Finch", 0.7, "finch.wav"],
		],
		["recent.wav", "best.wav", "finch.wav"],
	);
	const best = bestRecordings(database, root);
	assert.equal(best.get("Blue Jay")?.fileName, "best.wav");
	assert.equal(best.get("House Finch")?.fileName, "finch.wav");
});

test("breaks a confidence tie toward the most recent clip", () => {
	const { database, root } = fixture(
		[
			["2026-06-30", "06:00:00", "Blue Jay", 0.9, "older.wav"],
			["2026-07-30", "06:00:00", "Blue Jay", 0.9, "newer.wav"],
		],
		["older.wav", "newer.wav"],
	);
	assert.equal(
		bestRecordings(database, root).get("Blue Jay")?.fileName,
		"newer.wav",
	);
});

test("falls back to the next-best clip still on disk", () => {
	const { database, root } = fixture(
		[
			["2026-06-30", "06:00:00", "Blue Jay", 0.98, "deleted.wav"],
			["2026-07-01", "06:00:00", "Blue Jay", 0.9, "runner-up.wav"],
			["2026-07-02", "06:00:00", "Blue Jay", 0.5, "weak.wav"],
		],
		["runner-up.wav", "weak.wav"],
	);
	assert.equal(
		bestRecordings(database, root).get("Blue Jay")?.fileName,
		"runner-up.wav",
	);
});

test("leaves out a species with nothing left on disk", () => {
	const { database, root } = fixture(
		[["2026-06-30", "06:00:00", "Blue Jay", 0.98, "deleted.wav"]],
		[],
	);
	assert.equal(bestRecordings(database, root).has("Blue Jay"), false);
});

test("narrows to one species when named", () => {
	const { database, root } = fixture(
		[
			["2026-06-30", "06:00:00", "Blue Jay", 0.98, "jay.wav"],
			["2026-06-30", "06:00:00", "House Finch", 0.9, "finch.wav"],
		],
		["jay.wav", "finch.wav"],
	);
	assert.deepEqual(
		[...bestRecordings(database, root, "Blue Jay").keys()],
		["Blue Jay"],
	);
});

const CHECKED_AT = "2026-11-06T00:00:00.000Z";
const VOICE = VOICE_SCORE_LIMIT + 0.5;
const NO_VOICE = VOICE_SCORE_LIMIT / 2;
const ALL_ON_DISK = ["best.wav", "next.wav", "recent.wav"];

const blueJayClips = (): Row[] => [
	["2026-06-30", "06:00:00", "Blue Jay", 0.98, "best.wav"],
	["2026-07-01", "07:00:00", "Blue Jay", 0.9, "next.wav"],
	["2026-10-19", "12:00:00", "Blue Jay", 0.8, "recent.wav"],
];

const clipFile = (date: string, fileName: string, speciesDir = "Blue_Jay") => ({
	date,
	speciesDir,
	fileName,
});

test("an unchecked clip stays private and is next in line", () => {
	const { database, root } = fixture(blueJayClips(), ALL_ON_DISK);
	const { recordings, unchecked } = publicRecordings(database, root);
	assert.equal(recordings.size, 0);
	assert.deepEqual(
		unchecked.map((clip) => clip.fileName),
		["best.wav"],
	);
	assert.equal(
		isPublicRecording(database, root, clipFile("2026-06-30", "best.wav")),
		false,
	);
});

test("a clean best clip is public and no other clip is", () => {
	const { database, root } = fixture(blueJayClips(), ALL_ON_DISK);
	saveVoiceCheck(
		database,
		{ date: "2026-06-30", fileName: "best.wav" },
		NO_VOICE,
		CHECKED_AT,
	);
	assert.equal(
		isPublicRecording(database, root, clipFile("2026-06-30", "best.wav")),
		true,
	);
	assert.equal(
		isPublicRecording(database, root, clipFile("2026-10-19", "recent.wav")),
		false,
	);
	assert.equal(
		isPublicRecording(
			database,
			root,
			clipFile("2026-06-30", "best.wav", "House_Finch"),
		),
		false,
	);
	assert.equal(
		isPublicRecording(database, root, clipFile("2026-10-19", "best.wav")),
		false,
	);
});

test("a best clip with a voice is locked and the next clip takes over", () => {
	const { database, root } = fixture(blueJayClips(), ALL_ON_DISK);
	saveVoiceCheck(
		database,
		{ date: "2026-06-30", fileName: "best.wav" },
		VOICE,
		CHECKED_AT,
	);
	saveVoiceCheck(
		database,
		{ date: "2026-07-01", fileName: "next.wav" },
		NO_VOICE,
		CHECKED_AT,
	);
	assert.equal(
		isPublicRecording(database, root, clipFile("2026-06-30", "best.wav")),
		false,
	);
	assert.equal(
		isPublicRecording(database, root, clipFile("2026-07-01", "next.wav")),
		true,
	);
	assert.equal(
		bestRecordings(database, root).get("Blue Jay")?.fileName,
		"best.wav",
	);
});

test("a clean clip keeps playing while a newer best clip waits for its check", () => {
	const { database, root } = fixture(blueJayClips(), ALL_ON_DISK);
	saveVoiceCheck(
		database,
		{ date: "2026-07-01", fileName: "next.wav" },
		NO_VOICE,
		CHECKED_AT,
	);
	const { recordings, unchecked } = publicRecordings(database, root);
	assert.equal(recordings.get("Blue Jay")?.fileName, "next.wav");
	assert.deepEqual(
		unchecked.map((clip) => clip.fileName),
		["best.wav"],
	);
});

test("checks clips from the best down until one has no voice", async () => {
	const { database, root } = fixture(blueJayClips(), ALL_ON_DISK);
	const checked: string[] = [];
	await checkUncheckedRecordings(database, root, async (clip) => {
		checked.push(clip.fileName);
		return clip.fileName === "best.wav" ? VOICE : NO_VOICE;
	});
	assert.deepEqual(checked, ["best.wav", "next.wav"]);
	assert.equal(
		publicRecordings(database, root).recordings.get("Blue Jay")?.fileName,
		"next.wav",
	);
});

test("a species whose every clip has a voice has no public clip", async () => {
	const { database, root } = fixture(blueJayClips(), ALL_ON_DISK);
	await checkUncheckedRecordings(database, root, async () => VOICE);
	const { recordings, unchecked } = publicRecordings(database, root);
	assert.equal(recordings.size, 0);
	assert.equal(unchecked.length, 0);
});

test("a failed check saves nothing, so the clip stays private", async () => {
	const { database, root } = fixture(blueJayClips(), ["best.wav"]);
	await assert.rejects(
		checkUncheckedRecordings(database, root, async () => {
			throw new Error("Python is missing");
		}),
	);
	assert.equal(
		isPublicRecording(database, root, clipFile("2026-06-30", "best.wav")),
		false,
	);
});
