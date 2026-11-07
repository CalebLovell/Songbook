import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { afterEach, test } from "node:test";
import tar from "tar-stream";

import { createBackupStream, type DataPaths } from "./data-backup.server.ts";
import {
	CHECKSUMS_PATH,
	isBackupPath,
	MANIFEST_PATH,
} from "./data-backup-format.ts";
import { detectionCsvChunks } from "./data-export.server.ts";
import {
	applyStagedRestore,
	deleteSafetyCopy,
	discardStagedBackup,
	RestoreRefused,
	readDataSummary,
	readSafetyCopy,
	stageBackup,
	undoLastRestore,
} from "./data-restore.server.ts";

const NO_SYSTEM = { skipSystemActions: true };
const directories: string[] = [];

afterEach(async () => {
	for (const directory of directories.splice(0))
		await rm(directory, { recursive: true, force: true });
});

function seedDatabase(databasePath: string, rows: [string, string, string][]) {
	const database = new DatabaseSync(databasePath);
	database.exec(`CREATE TABLE detections (
		Date DATE, Time TIME, Sci_Name VARCHAR(100) NOT NULL, Com_Name VARCHAR(100) NOT NULL,
		Confidence FLOAT, Lat FLOAT, Lon FLOAT, Cutoff FLOAT, Week INT, Sens FLOAT, Overlap FLOAT,
		File_Name VARCHAR(100) NOT NULL);
		CREATE INDEX detections_Date_Time ON detections (Date DESC, Time DESC);
		CREATE TABLE voice_checks (file TEXT PRIMARY KEY, voice INTEGER);`);
	const insert = database.prepare(
		"INSERT INTO detections VALUES (?, ?, ?, ?, 0.9, 42.5, -76.5, 0.7, 45, 1.25, 0, ?)",
	);
	database.exec("BEGIN");
	for (const [date, sci, com] of rows)
		insert.run(date, "06:00:00", sci, com, `${com}-90-${date}.mp3`);
	database.exec("COMMIT");
	database.close();
}

async function makeStation(
	name: string,
	rows: [string, string, string][],
	clips: Record<string, string>,
): Promise<DataPaths> {
	const root = await mkdtemp(path.join(tmpdir(), `songbook-${name}-`));
	directories.push(root);
	const paths: DataPaths = {
		databasePath: path.join(root, "birds.db"),
		extractedDir: path.join(root, "Extracted"),
		settingsPath: path.join(root, "birdnet.conf"),
		speciesListDir: path.join(root, "lists"),
		workDir: path.join(root, "Songbook-data"),
		timezone: "UTC",
	};
	seedDatabase(paths.databasePath, rows);
	await writeFile(
		paths.settingsPath,
		`SITE_NAME="${name}"\nLATITUDE=42.5\nLONGITUDE=-76.5\nCONFIDENCE=0.7\nREC_CARD="machine-mic"\nCADDY_PWD="secret-password"\nRTSP_STREAM="rtsp://user:pw@cam/stream"\n`,
	);
	await mkdir(paths.speciesListDir, { recursive: true });
	await writeFile(
		path.join(paths.speciesListDir, "exclude_species_list.txt"),
		`${name} excluded\n`,
	);
	for (const [relative, contents] of Object.entries(clips)) {
		const file = path.join(paths.extractedDir, "By_Date", relative);
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, contents);
	}
	return paths;
}

const SOURCE_ROWS: [string, string, string][] = [
	["2026-07-05", "Turdus migratorius", "American Robin"],
	["2026-07-06", "Spinus tristis", "American Goldfinch"],
	["2026-07-06", "Turdus migratorius", "American Robin"],
];
const SOURCE_CLIPS = {
	"2026-07-05/American_Robin/American_Robin-90-2026-07-05.mp3": "robin audio",
	"2026-07-06/American_Goldfinch/American_Goldfinch-90-2026-07-06.mp3":
		"goldfinch audio",
};

function sourceStation() {
	return makeStation("Source", SOURCE_ROWS, SOURCE_CLIPS);
}

function targetStation() {
	return makeStation(
		"Target",
		[["2026-01-01", "Corvus corax", "Common Raven"]],
		{ "2026-01-01/Common_Raven/Common_Raven-90-2026-01-01.mp3": "raven audio" },
	);
}

async function backupBytes(paths: DataPaths, includeClips = true) {
	return buffer(createBackupStream(paths, includeClips));
}

function detectionNames(paths: DataPaths) {
	const database = new DatabaseSync(paths.databasePath, { readOnly: true });
	try {
		return (
			database
				.prepare("SELECT Com_Name AS name FROM detections ORDER BY Date, rowid")
				.all() as { name: string }[]
		).map((row) => row.name);
	} finally {
		database.close();
	}
}

async function readEntries(archive: Buffer) {
	const entries = new Map<string, Buffer>();
	const extract = tar.extract();
	Readable.from([archive]).pipe(extract);
	for await (const entry of extract) {
		entries.set(entry.header.name, await buffer(entry));
	}
	return entries;
}

async function packEntries(entries: [string, Buffer | string][]) {
	const pack = tar.pack();
	for (const [name, contents] of entries) pack.entry({ name }, contents);
	pack.finalize();
	return buffer(pack);
}

async function assertRefused(work: Promise<unknown>, message?: RegExp) {
	await assert.rejects(work, (error: unknown) => {
		assert.ok(error instanceof RestoreRefused, String(error));
		if (message) assert.match(error.message, message);
		return true;
	});
}

test("a backup carries the data and leaves machine settings and secrets out", async () => {
	const source = await sourceStation();
	const entries = await readEntries(await backupBytes(source));

	assert.ok(entries.has(MANIFEST_PATH));
	assert.ok(entries.has(CHECKSUMS_PATH));
	assert.ok(entries.has("data/birds.db"));
	assert.ok(entries.has("species-lists/exclude_species_list.txt"));
	assert.equal(
		entries
			.get(
				"clips/By_Date/2026-07-05/American_Robin/American_Robin-90-2026-07-05.mp3",
			)
			?.toString(),
		"robin audio",
	);
	for (const name of entries.keys()) assert.ok(isBackupPath(name), name);

	const text = [...entries.entries()]
		.filter(([name]) => name.endsWith(".json"))
		.map(([, contents]) => contents.toString())
		.join("\n");
	assert.doesNotMatch(text, /secret-password|machine-mic|user:pw/);
	assert.match(text, /"siteName": "Source"/);

	assert.deepEqual(await readdir(source.workDir), []);
});

test("a backup without clips still restores, and keeps this station's clips", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	const preview = await stageBackup(
		Readable.from([await backupBytes(source, false)]),
		null,
		target,
	);
	assert.equal(preview.includesClips, false);
	assert.equal(preview.clipFiles, 0);

	await applyStagedRestore(preview.id, target, NO_SYSTEM);

	assert.equal(detectionNames(target).length, 3);
	assert.ok(
		existsSync(
			path.join(
				target.extractedDir,
				"By_Date/2026-01-01/Common_Raven/Common_Raven-90-2026-01-01.mp3",
			),
		),
	);
});

test("staging checks a backup and changes nothing on the station", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	const preview = await stageBackup(
		Readable.from([await backupBytes(source)]),
		null,
		target,
	);

	assert.equal(preview.stationName, "Source");
	assert.equal(preview.detections, 3);
	assert.equal(preview.species, 2);
	assert.equal(preview.firstDate, "2026-07-05");
	assert.equal(preview.lastDate, "2026-07-06");
	assert.equal(preview.clipFiles, 2);
	assert.deepEqual(detectionNames(target), ["Common Raven"]);
	assert.match(
		await readFile(target.settingsPath, "utf8"),
		/SITE_NAME="Target"/,
	);

	const summary = await readDataSummary(target);
	assert.equal(summary.staged?.id, preview.id);
	assert.equal(summary.detections, 1);

	await discardStagedBackup(target);
	assert.equal((await readDataSummary(target)).staged, null);
});

test("restoring swaps everything in, keeps machine settings, and can be undone", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	const preview = await stageBackup(
		Readable.from([await backupBytes(source)]),
		null,
		target,
	);
	const liveReader = new DatabaseSync(target.databasePath, { readOnly: true });

	await applyStagedRestore(preview.id, target, NO_SYSTEM);

	assert.deepEqual(detectionNames(target), [
		"American Robin",
		"American Goldfinch",
		"American Robin",
	]);
	const { total } = liveReader
		.prepare("SELECT COUNT(*) AS total FROM detections")
		.get() as { total: number };
	assert.equal(total, 3, "a connection opened before the restore sees it");
	liveReader.close();

	const restoredClip = path.join(
		target.extractedDir,
		"By_Date/2026-07-05/American_Robin/American_Robin-90-2026-07-05.mp3",
	);
	const oldClip = path.join(
		target.extractedDir,
		"By_Date/2026-01-01/Common_Raven/Common_Raven-90-2026-01-01.mp3",
	);
	assert.equal(await readFile(restoredClip, "utf8"), "robin audio");
	assert.ok(!existsSync(oldClip));

	const conf = await readFile(target.settingsPath, "utf8");
	assert.match(conf, /SITE_NAME="Source"/);
	assert.match(conf, /REC_CARD="machine-mic"/);
	assert.match(conf, /CADDY_PWD="secret-password"/);
	assert.equal(
		await readFile(
			path.join(target.speciesListDir, "exclude_species_list.txt"),
			"utf8",
		),
		"Source excluded\n",
	);
	assert.ok(await readSafetyCopy(target));
	assert.equal((await readDataSummary(target)).staged, null);

	await undoLastRestore(target, NO_SYSTEM);

	assert.deepEqual(detectionNames(target), ["Common Raven"]);
	assert.equal(await readFile(oldClip, "utf8"), "raven audio");
	assert.ok(!existsSync(restoredClip));
	assert.match(
		await readFile(target.settingsPath, "utf8"),
		/SITE_NAME="Target"/,
	);
	assert.equal(
		await readFile(
			path.join(target.speciesListDir, "exclude_species_list.txt"),
			"utf8",
		),
		"Target excluded\n",
	);
	assert.equal(await readSafetyCopy(target), null);
});

test("a second restore waits until the safety copy is undone or deleted", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	const archive = await backupBytes(source);
	const preview = await stageBackup(Readable.from([archive]), null, target);
	await applyStagedRestore(preview.id, target, NO_SYSTEM);

	await assertRefused(
		stageBackup(Readable.from([archive]), null, target),
		/safety copy/,
	);

	await deleteSafetyCopy(target);
	assert.equal(await readSafetyCopy(target), null);
	await stageBackup(Readable.from([archive]), null, target);
});

test("a restore that fails partway puts the station's data back", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	const preview = await stageBackup(
		Readable.from([await backupBytes(source)]),
		null,
		target,
	);
	const blocked = path.join(target.workDir, "blocked");
	await writeFile(blocked, "a file where a folder has to go");
	const failing = { ...target, speciesListDir: blocked };

	await assertRefused(
		applyStagedRestore(preview.id, failing, NO_SYSTEM),
		/safety copy was kept/,
	);

	assert.deepEqual(detectionNames(target), ["Common Raven"]);
	assert.match(
		await readFile(target.settingsPath, "utf8"),
		/SITE_NAME="Target"/,
	);
	assert.equal(
		await readFile(
			path.join(
				target.extractedDir,
				"By_Date/2026-01-01/Common_Raven/Common_Raven-90-2026-01-01.mp3",
			),
			"utf8",
		),
		"raven audio",
	);
	assert.ok(await readSafetyCopy(target));
});

test("a restore that can't save a safety copy changes nothing", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	const preview = await stageBackup(
		Readable.from([await backupBytes(source)]),
		null,
		target,
	);
	const failing = {
		...target,
		settingsPath: path.join(target.workDir, "missing.conf"),
	};
	await assert.rejects(applyStagedRestore(preview.id, failing, NO_SYSTEM));
	assert.deepEqual(detectionNames(target), ["Common Raven"]);
	assert.equal(await readSafetyCopy(target), null);
});

test("the wrong staged id is refused", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	await stageBackup(Readable.from([await backupBytes(source)]), null, target);
	await assertRefused(
		applyStagedRestore(
			"00000000-0000-4000-8000-000000000000",
			target,
			NO_SYSTEM,
		),
		/no longer waiting/,
	);
	assert.deepEqual(detectionNames(target), ["Common Raven"]);
});

test("broken files are refused and leave nothing behind", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	const good = await backupBytes(source);
	const entries = [...(await readEntries(good)).entries()];
	const without = (name: string) =>
		entries.filter(([entryName]) => entryName !== name);
	const tampered = entries.map(([name, contents]): [string, Buffer] =>
		name.startsWith("clips/")
			? [name, Buffer.from("changed")]
			: [name, contents],
	);
	const manifest = JSON.parse(
		entries.find(([name]) => name === MANIFEST_PATH)?.[1].toString() ?? "{}",
	);
	const newerManifest = Buffer.from(
		JSON.stringify({ ...manifest, formatVersion: 99 }),
	);
	const checksums = JSON.parse(
		entries.find(([name]) => name === CHECKSUMS_PATH)?.[1].toString() ?? "{}",
	);
	checksums[MANIFEST_PATH] = {
		size: newerManifest.length,
		sha256: createHash("sha256").update(newerManifest).digest("hex"),
	};
	const newer = entries.map(([name, contents]): [string, Buffer] => {
		if (name === MANIFEST_PATH) return [name, newerManifest];
		if (name === CHECKSUMS_PATH)
			return [name, Buffer.from(JSON.stringify(checksums))];
		return [name, contents];
	});

	const cases: [string, Buffer, RegExp?][] = [
		["a file that isn't a backup", Buffer.from("not a tar file".repeat(100))],
		["an empty file", Buffer.alloc(0)],
		["a download that stopped early", good.subarray(0, good.length / 2)],
		["no checksums", await packEntries(without(CHECKSUMS_PATH))],
		["changed contents", await packEntries(tampered)],
		["a path outside the backup", await packEntries([["../../evil.txt", "x"]])],
		[
			"a clip path that climbs out",
			await packEntries([["clips/By_Date/2026-01-01/../../../evil.mp3", "x"]]),
		],
		["an unknown file", await packEntries([["birdnet.conf", "x"]])],
		["a newer format", await packEntries(newer), /newer version/],
	];
	for (const [name, archive, message] of cases) {
		await assertRefused(
			stageBackup(Readable.from([archive]), null, target),
			message,
		).catch((error) => {
			throw new Error(`${name}: ${error}`);
		});
		assert.ok(!existsSync(path.join(target.workDir, "staging")), name);
		assert.deepEqual(detectionNames(target), ["Common Raven"], name);
	}
});

test("a corrupted database inside a backup is refused", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	const entries = [...(await readEntries(await backupBytes(source))).entries()];
	const corrupt = Buffer.from("this is not a database");
	const checksums = JSON.parse(
		entries.find(([name]) => name === CHECKSUMS_PATH)?.[1].toString() ?? "{}",
	);
	checksums["data/birds.db"] = {
		size: corrupt.length,
		sha256: createHash("sha256").update(corrupt).digest("hex"),
	};
	const archive = await packEntries(
		entries.map(([name, contents]): [string, Buffer] => {
			if (name === "data/birds.db") return [name, corrupt];
			if (name === CHECKSUMS_PATH)
				return [name, Buffer.from(JSON.stringify(checksums))];
			return [name, contents];
		}),
	);
	await assertRefused(stageBackup(Readable.from([archive]), null, target));
	assert.deepEqual(detectionNames(target), ["Common Raven"]);
});

test("a backup too big for the disk is refused before receiving it", async () => {
	const source = await sourceStation();
	const target = await targetStation();
	await assertRefused(
		stageBackup(
			Readable.from([await backupBytes(source)]),
			Number.MAX_SAFE_INTEGER,
			target,
		),
		/enough free disk space/,
	);
});

test("stopping a download early cleans up its temporary database", async () => {
	const source = await sourceStation();
	const stream = createBackupStream(source, true);
	await new Promise<void>((resolve) => stream.once("readable", resolve));
	stream.destroy();
	await new Promise((resolve) => setTimeout(resolve, 100));
	assert.deepEqual(await readdir(source.workDir), []);
});

async function csvText(paths: DataPaths, query = {}) {
	let text = "";
	for await (const chunk of detectionCsvChunks(paths.databasePath, query))
		text += chunk;
	return text;
}

test("the CSV lists every detection in time order under a header", async () => {
	const source = await sourceStation();
	const lines = (await csvText(source)).trim().split("\r\n");
	assert.equal(
		lines[0],
		"Date,Time,Sci_Name,Com_Name,Confidence,Lat,Lon,Cutoff,Week,Sens,Overlap,File_Name",
	);
	assert.equal(lines.length, 4);
	assert.ok(lines[1].startsWith("2026-07-05,06:00:00,Turdus migratorius"));
});

test("the CSV filters by date and species", async () => {
	const source = await sourceStation();
	const dated = (await csvText(source, { from: "2026-07-06" }))
		.trim()
		.split("\r\n");
	assert.equal(dated.length, 3);
	const bird = (await csvText(source, { species: "Spinus tristis" }))
		.trim()
		.split("\r\n");
	assert.equal(bird.length, 2);
	const none = (await csvText(source, { to: "2020-01-01" }))
		.trim()
		.split("\r\n");
	assert.equal(none.length, 1);
});

test("the CSV quotes awkward values and pages through big tables", async () => {
	const root = await mkdtemp(path.join(tmpdir(), "songbook-csv-"));
	directories.push(root);
	const databasePath = path.join(root, "birds.db");
	const rows: [string, string, string][] = [
		["2026-01-01", "Quoted name", 'A "quoted", name'],
	];
	for (let index = 0; index < 4500; index += 1)
		rows.push(["2026-01-02", "Many", "Many"]);
	seedDatabase(databasePath, rows);
	const text = await csvText({ databasePath } as DataPaths);
	assert.match(text, /"A ""quoted"", name"/);
	assert.equal(text.trim().split("\r\n").length, 4502);
});
