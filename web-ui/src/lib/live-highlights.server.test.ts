import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

const databasePath = path.join(
	mkdtempSync(path.join(tmpdir(), "live-highlights-")),
	"birds.db",
);
const writer = new DatabaseSync(databasePath);
writer.exec(
	`CREATE TABLE detections (Date DATE, Time TIME, Sci_Name VARCHAR(100) NOT NULL, Com_Name VARCHAR(100) NOT NULL, Confidence FLOAT, Lat FLOAT, Lon FLOAT, Cutoff FLOAT, Week INT, Sens FLOAT, Overlap FLOAT, File_Name VARCHAR(100) NOT NULL);
	CREATE INDEX detections_Com_Name ON detections (Com_Name);
	CREATE INDEX detections_Date_Time ON detections (Date DESC, Time DESC);`,
);
process.env.BIRDNET_DB_PATH = databasePath;
const { readLiveTallies } = await import("./live-highlights.server.ts");

type Row = [comName: string, ...modifiers: string[]];

function insertRows(rows: Row[]) {
	writer.exec("BEGIN");
	for (const [comName, ...modifiers] of rows) {
		const at = `datetime('now', ${modifiers.map((m) => `'${m}'`).join(", ")}, 'localtime')`;
		writer
			.prepare(
				`INSERT INTO detections (Date, Time, Sci_Name, Com_Name, File_Name) VALUES (date(${at}), time(${at}), 'sci', ?, 'clip.wav')`,
			)
			.run(comName);
	}
	writer.exec("COMMIT");
}

function sliceAndTimestamp(comName: string) {
	return writer
		.prepare(
			`SELECT cast(julianday('now', 'localtime') - julianday(Date || ' ' || Time) as integer) AS slice, datetime(Date || ' ' || Time) AS at FROM detections WHERE Com_Name = ?`,
		)
		.get(comName) as { slice: number; at: string };
}

async function withinOneSecond<T>(check: () => Promise<T>): Promise<T> {
	for (;;) {
		await sleep(1_000 - (Date.now() % 1_000) + 5);
		const second = Math.floor(Date.now() / 1_000);
		writer.exec("DELETE FROM detections");
		const result = await check();
		if (Math.floor(Date.now() / 1_000) === second) return result;
	}
}

test("the 24 hour mark splits the window and history apart from the day slices", async () => {
	const { tallies, onTheMark, justBefore, justInside } = await withinOneSecond(
		async () => {
			insertRows([
				["On the mark", "-24 hours"],
				["Just before", "-24 hours", "-1 second"],
				["Just inside", "-24 hours", "+1 second"],
			]);
			return {
				tallies: await readLiveTallies(3),
				onTheMark: sliceAndTimestamp("On the mark"),
				justBefore: sliceAndTimestamp("Just before"),
				justInside: sliceAndTimestamp("Just inside"),
			};
		},
	);

	assert.equal(tallies.firstInWindow.get("On the mark"), onTheMark.at);
	assert.equal(tallies.history.has("On the mark"), false);
	assert.equal(tallies.slices[onTheMark.slice].get("On the mark"), 1);
	assert.equal(tallies.slices[0].has("On the mark"), onTheMark.slice === 0);

	assert.equal(tallies.firstInWindow.has("Just before"), false);
	assert.deepEqual(tallies.history.get("Just before"), {
		countBefore: 1,
		lastBefore: justBefore.at,
	});
	assert.equal(tallies.slices[justBefore.slice].get("Just before"), 1);

	assert.equal(tallies.firstInWindow.get("Just inside"), justInside.at);
	assert.equal(tallies.history.has("Just inside"), false);
	assert.equal(tallies.slices[justInside.slice].get("Just inside"), 1);
});

test("a species' days fold into one window and one history", async () => {
	const tallies = await withinOneSecond(async () => {
		insertRows([
			["Blue Jay", "-1 hours"],
			["Blue Jay", "-2 hours"],
			["Blue Jay", "-50 hours"],
			["Blue Jay", "-100 hours"],
			["Blue Jay", "-100 hours"],
			["Blue Jay", "-2000 hours"],
		]);
		return readLiveTallies(3);
	});
	const history = tallies.history.get("Blue Jay");

	assert.equal(history?.countBefore, 4);
	assert.equal(tallies.slices[0].get("Blue Jay"), 2);
	assert.equal(tallies.slices[2].get("Blue Jay"), 1);
	assert.equal(tallies.daysBefore.at(-1)?.has("Blue Jay"), true);
	assert.ok(
		(tallies.firstInWindow.get("Blue Jay") ?? "") > (history?.lastBefore ?? ""),
	);
});

test("rows past the lookback stay out of the slices but count as history", async () => {
	const tallies = await withinOneSecond(async () => {
		insertRows([["Old Friend", "-30 days"]]);
		return readLiveTallies(3);
	});

	assert.equal(tallies.slices.length, 4);
	assert.ok(tallies.slices.every((slice) => !slice.has("Old Friend")));
	assert.equal(tallies.history.get("Old Friend")?.countBefore, 1);
});

test("a row with an unreadable date only proves the station has detections", async () => {
	writer.exec("DELETE FROM detections");
	assert.equal((await readLiveTallies(3)).hasAnyDetections, false);

	writer
		.prepare(
			"INSERT INTO detections (Date, Time, Sci_Name, Com_Name, File_Name) VALUES (NULL, NULL, 'sci', 'Nameless', 'clip.wav')",
		)
		.run();
	const tallies = await readLiveTallies(3);

	assert.equal(tallies.hasAnyDetections, true);
	assert.equal(tallies.history.size, 0);
	assert.equal(tallies.firstInWindow.size, 0);
	assert.ok(tallies.slices.every((slice) => slice.size === 0));
});
