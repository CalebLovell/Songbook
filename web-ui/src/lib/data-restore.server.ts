import "@tanstack/react-start/server-only";

import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
	access,
	chmod,
	copyFile,
	mkdir,
	realpath,
	rename,
	rm,
	stat,
	statfs,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import tar from "tar-stream";
import {
	type DataPaths,
	readBackupSettings,
	readJsonFile,
	readStationFigures,
	snapshotDatabase,
} from "./data-backup.server.ts";
import {
	BACKUP_FORMAT_VERSION,
	backupChecksumsSchema,
	backupManifestSchema,
	backupSettingsSchema,
	CHECKSUMS_PATH,
	CLIPS_DIR,
	DATABASE_PATH,
	type DataSummary,
	isBackupPath,
	isClipPath,
	MANIFEST_PATH,
	type RestoreOutcome,
	type RestorePreview,
	restorePreviewSchema,
	type SafetyCopy,
	SETTINGS_PATH,
	SPECIES_LIST_FILES,
	SPECIES_LISTS_DIR,
	safetyCopySchema,
} from "./data-backup-format.ts";
import { currentTimezone } from "./settings.server.ts";
import { writeSettingsCard } from "./settings-config.server.ts";
import {
	runCardSystemActions,
	type SettingsCommandRunner,
	startStationServices,
	stopStationServices,
} from "./settings-system.server.ts";

export class RestoreRefused extends Error {
	readonly status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.name = "RestoreRefused";
		this.status = status;
	}
}

export type RestoreDependencies = {
	skipSystemActions?: boolean;
	runner?: SettingsCommandRunner;
};

const DETECTION_COLUMNS = [
	"Date",
	"Time",
	"Sci_Name",
	"Com_Name",
	"Confidence",
	"Lat",
	"Lon",
	"Cutoff",
	"Week",
	"Sens",
	"Overlap",
	"File_Name",
];
const DISK_HEADROOM_BYTES = 512 * 1024 * 1024;
const MAX_METADATA_BYTES = 64 * 1024 * 1024;
const NOT_A_BACKUP =
	"This file isn't a complete Songbook backup. It may be the wrong file, or the download may have stopped early.";
const SAFETY_COPY_EXISTS =
	"Undo the last restore or delete its safety copy before restoring again.";
const NEEDS_RESTART =
	"BirdNET could not be restarted. Restart it from Settings so it starts recording again.";

let busy = false;

async function exclusively<T>(work: () => Promise<T>): Promise<T> {
	if (busy)
		throw new RestoreRefused(
			"Another restore step is still running. Try again when it finishes.",
			409,
		);
	busy = true;
	try {
		return await work();
	} finally {
		busy = false;
	}
}

function stagingDir(paths: DataPaths) {
	return path.join(paths.workDir, "staging");
}

function payloadDir(paths: DataPaths) {
	return path.join(stagingDir(paths), "payload");
}

function readyFile(paths: DataPaths) {
	return path.join(stagingDir(paths), "ready.json");
}

function safetyDir(paths: DataPaths) {
	return path.join(paths.workDir, "safety");
}

function safetyFile(paths: DataPaths) {
	return path.join(safetyDir(paths), "safety.json");
}

function byDateDir(paths: DataPaths) {
	return path.join(paths.extractedDir, "By_Date");
}

async function pathExists(target: string) {
	try {
		await access(target);
		return true;
	} catch {
		return false;
	}
}

export async function readSafetyCopy(
	paths: DataPaths,
): Promise<SafetyCopy | null> {
	try {
		return safetyCopySchema.parse(await readJsonFile(safetyFile(paths)));
	} catch {
		return null;
	}
}

async function readStagedPreview(
	paths: DataPaths,
): Promise<RestorePreview | null> {
	try {
		return restorePreviewSchema.parse(await readJsonFile(readyFile(paths)));
	} catch {
		return null;
	}
}

export async function readRestoreState(paths: DataPaths) {
	const staged = await readStagedPreview(paths);
	if (!staged && !busy)
		await rm(stagingDir(paths), { recursive: true, force: true });
	return { staged, safetyCopy: await readSafetyCopy(paths) };
}

export async function readDataSummary(paths: DataPaths): Promise<DataSummary> {
	const [figures, state] = await Promise.all([
		readStationFigures(paths),
		readRestoreState(paths),
	]);
	return { ...figures, ...state };
}

function refusedFromTarError(error: unknown) {
	const { code, syscall } = error as NodeJS.ErrnoException;
	if (code === "ENOSPC")
		return new RestoreRefused(
			"The station ran out of disk space while receiving this backup. Nothing was changed.",
			507,
		);
	return syscall ? (error as Error) : new RestoreRefused(NOT_A_BACKUP);
}

async function receiveEntries(source: Readable, payload: string) {
	const extract = tar.extract();
	const received = new Map<string, { size: number; sha256: string }>();
	const directories = new Set<string>();
	const feeding = pipeline(source, extract).catch((error: Error) => {
		extract.destroy(error);
	});
	let checksumsSeen = false;
	for await (const entry of extract) {
		const { name, type, size } = entry.header;
		if (
			type !== "file" ||
			checksumsSeen ||
			!isBackupPath(name) ||
			received.has(name) ||
			(!isClipPath(name) &&
				name !== DATABASE_PATH &&
				(size ?? 0) > MAX_METADATA_BYTES)
		)
			throw new RestoreRefused(NOT_A_BACKUP);
		const destination = path.join(payload, ...name.split("/"));
		const parent = path.dirname(destination);
		if (!directories.has(parent)) {
			await mkdir(parent, { recursive: true });
			directories.add(parent);
		}
		const hash = createHash("sha256");
		let written = 0;
		await pipeline(
			entry,
			async function* (chunks) {
				for await (const chunk of chunks) {
					hash.update(chunk as Buffer);
					written += (chunk as Buffer).length;
					yield chunk;
				}
			},
			createWriteStream(destination, { flags: "wx" }),
		);
		received.set(name, { size: written, sha256: hash.digest("hex") });
		if (name === CHECKSUMS_PATH) checksumsSeen = true;
	}
	await feeding;
	return received;
}

function verifyChecksums(
	received: Map<string, { size: number; sha256: string }>,
	checksums: Record<string, { size: number; sha256: string }>,
) {
	const expected = Object.entries(checksums);
	if (expected.length !== received.size - 1)
		throw new RestoreRefused(NOT_A_BACKUP);
	for (const [name, want] of expected) {
		const got = received.get(name);
		if (!got || got.size !== want.size || got.sha256 !== want.sha256)
			throw new RestoreRefused(NOT_A_BACKUP);
	}
}

function readBackupFigures(databasePath: string) {
	let database: DatabaseSync;
	try {
		database = new DatabaseSync(databasePath, { readOnly: true });
	} catch {
		throw new RestoreRefused(NOT_A_BACKUP);
	}
	try {
		const integrity = database.prepare("PRAGMA integrity_check").get() as {
			integrity_check: string;
		};
		if (integrity.integrity_check !== "ok")
			throw new RestoreRefused(NOT_A_BACKUP);
		const columns = (
			database.prepare("PRAGMA table_info(detections)").all() as {
				name: string;
			}[]
		).map((column) => column.name);
		if (!DETECTION_COLUMNS.every((column) => columns.includes(column)))
			throw new RestoreRefused(NOT_A_BACKUP);
		return database
			.prepare(
				"SELECT COUNT(*) AS detections, COUNT(DISTINCT Sci_Name) AS species, MIN(Date) AS firstDate, MAX(Date) AS lastDate FROM detections",
			)
			.get() as {
			detections: number;
			species: number;
			firstDate: string | null;
			lastDate: string | null;
		};
	} catch (error) {
		if (error instanceof RestoreRefused) throw error;
		throw new RestoreRefused(NOT_A_BACKUP);
	} finally {
		database.close();
	}
}

async function checkFreeSpace(paths: DataPaths, incomingBytes: number | null) {
	if (incomingBytes === null) return;
	const disk = await statfs(paths.workDir);
	if (disk.bavail * disk.bsize < incomingBytes + DISK_HEADROOM_BYTES)
		throw new RestoreRefused(
			"The station doesn't have enough free disk space to receive this backup. Nothing was changed.",
			507,
		);
}

export function stageBackup(
	source: Readable,
	incomingBytes: number | null,
	paths: DataPaths,
): Promise<RestorePreview> {
	return exclusively(async () => {
		if (await readSafetyCopy(paths))
			throw new RestoreRefused(SAFETY_COPY_EXISTS, 409);
		await rm(stagingDir(paths), { recursive: true, force: true });
		const payload = payloadDir(paths);
		await mkdir(payload, { recursive: true });
		try {
			await checkFreeSpace(paths, incomingBytes);
			const received = await receiveEntries(source, payload).catch((error) => {
				if (error instanceof RestoreRefused) throw error;
				throw refusedFromTarError(error);
			});
			for (const required of [
				MANIFEST_PATH,
				SETTINGS_PATH,
				DATABASE_PATH,
				CHECKSUMS_PATH,
			]) {
				if (!received.has(required)) throw new RestoreRefused(NOT_A_BACKUP);
			}
			const inStaging = (entry: string) =>
				path.join(payload, ...entry.split("/"));
			const parsedManifest = backupManifestSchema.safeParse(
				await readJsonFile(inStaging(MANIFEST_PATH)).catch(() => null),
			);
			if (!parsedManifest.success) throw new RestoreRefused(NOT_A_BACKUP);
			const manifest = parsedManifest.data;
			if (manifest.formatVersion > BACKUP_FORMAT_VERSION)
				throw new RestoreRefused(
					"This backup came from a newer version of Songbook. Update this station, then try again.",
				);
			const checksums = backupChecksumsSchema.safeParse(
				await readJsonFile(inStaging(CHECKSUMS_PATH)).catch(() => null),
			);
			if (!checksums.success) throw new RestoreRefused(NOT_A_BACKUP);
			verifyChecksums(received, checksums.data);
			const settings = backupSettingsSchema.safeParse(
				await readJsonFile(inStaging(SETTINGS_PATH)).catch(() => null),
			);
			if (!settings.success) throw new RestoreRefused(NOT_A_BACKUP);
			const figures = readBackupFigures(inStaging(DATABASE_PATH));
			let clipFiles = 0;
			let clipBytes = 0;
			for (const [name, entry] of received) {
				if (!isClipPath(name)) continue;
				clipFiles += 1;
				clipBytes += entry.size;
			}
			const preview: RestorePreview = {
				id: randomUUID(),
				createdAt: manifest.createdAt,
				stationName: manifest.stationName,
				includesClips: manifest.includesClips,
				...figures,
				clipFiles,
				clipBytes,
			};
			await writeFile(readyFile(paths), JSON.stringify(preview));
			return preview;
		} catch (error) {
			await rm(stagingDir(paths), { recursive: true, force: true });
			throw error;
		}
	});
}

export function discardStagedBackup(paths: DataPaths): Promise<void> {
	return exclusively(() =>
		rm(stagingDir(paths), { recursive: true, force: true }),
	);
}

function quoted(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

export function replaceDatabaseContents(target: string, incoming: string) {
	const database = new DatabaseSync(target);
	try {
		database.exec("PRAGMA busy_timeout = 30000");
		database.prepare("ATTACH DATABASE ? AS incoming").run(incoming);
		const objects = (source: "incoming" | "main", type: "index" | "table") =>
			database
				.prepare(
					`SELECT name, sql FROM ${source}.sqlite_master WHERE type = ? AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`,
				)
				.all(type) as { name: string; sql: string }[];
		database.exec("BEGIN IMMEDIATE");
		try {
			for (const table of objects("main", "table"))
				database.exec(`DROP TABLE main.${quoted(table.name)}`);
			for (const table of objects("incoming", "table")) {
				database.exec(table.sql);
				database.exec(
					`INSERT INTO main.${quoted(table.name)} SELECT * FROM incoming.${quoted(table.name)}`,
				);
			}
			for (const index of objects("incoming", "index"))
				database.exec(index.sql);
			database.exec("COMMIT");
		} catch (error) {
			database.exec("ROLLBACK");
			throw error;
		}
	} finally {
		database.close();
	}
}

async function writeFileBeside(destination: string, source: string) {
	const existing = await realpath(destination).catch(() => destination);
	const mode = await stat(existing).then(
		(info) => info.mode,
		() => 0o664,
	);
	const temporary = `${existing}.tmp-${process.pid}-${randomUUID()}`;
	try {
		await copyFile(source, temporary);
		await chmod(temporary, mode);
		await rename(temporary, existing);
	} finally {
		await rm(temporary, { force: true });
	}
}

async function applySpeciesLists(
	sourceDir: string,
	paths: DataPaths,
	removeMissing: boolean,
) {
	await mkdir(paths.speciesListDir, { recursive: true });
	for (const file of SPECIES_LIST_FILES) {
		const source = path.join(sourceDir, SPECIES_LISTS_DIR, file);
		const destination = path.join(paths.speciesListDir, file);
		if (await pathExists(source)) await writeFileBeside(destination, source);
		else if (removeMissing) await rm(destination, { force: true });
	}
}

async function applySettings(sourceDir: string, paths: DataPaths) {
	const settings = backupSettingsSchema.parse(
		await readJsonFile(path.join(sourceDir, SETTINGS_PATH)),
	);
	await writeSettingsCard("station", settings.station, paths.settingsPath);
	await writeSettingsCard("detection", settings.detection, paths.settingsPath);
	await writeSettingsCard("recording", settings.recording, paths.settingsPath);
	await writeSettingsCard("storage", settings.storage, paths.settingsPath);
	await writeSettingsCard("review", settings.review, paths.settingsPath);
	await writeSettingsCard(
		"highlights",
		settings.highlights,
		paths.settingsPath,
	);
	await writeSettingsCard("artwork", settings.artwork, paths.settingsPath);
	return settings;
}

async function swapClips(paths: DataPaths, incoming: string, aside: string) {
	const current = byDateDir(paths);
	await mkdir(path.dirname(aside), { recursive: true });
	await mkdir(paths.extractedDir, { recursive: true });
	const hadClips = await pathExists(current);
	if (hadClips) await rename(current, aside);
	try {
		await rename(incoming, current);
	} catch (error) {
		if (hadClips) await rename(aside, current);
		throw error;
	}
	return async () => {
		await rename(current, incoming);
		if (hadClips) await rename(aside, current);
	};
}

async function writeSafetyCopy(paths: DataPaths, includesClips: boolean) {
	const partial = path.join(paths.workDir, "safety.partial");
	await rm(partial, { recursive: true, force: true });
	await mkdir(path.join(partial, "data"), { recursive: true });
	snapshotDatabase(paths.databasePath, path.join(partial, DATABASE_PATH));
	await writeFile(
		path.join(partial, SETTINGS_PATH),
		JSON.stringify(await readBackupSettings(paths)),
	);
	await mkdir(path.join(partial, SPECIES_LISTS_DIR), { recursive: true });
	for (const file of SPECIES_LIST_FILES) {
		const source = path.join(paths.speciesListDir, file);
		if (await pathExists(source))
			await copyFile(source, path.join(partial, SPECIES_LISTS_DIR, file));
	}
	const safety: SafetyCopy = {
		createdAt: new Date().toISOString(),
		includesClips,
	};
	await writeFile(path.join(partial, "safety.json"), JSON.stringify(safety));
	await rename(partial, safetyDir(paths));
}

async function resumeStation(
	timezone: string,
	previousTimezone: string,
	dependencies: RestoreDependencies,
) {
	const warnings: string[] = [];
	if (timezone !== previousTimezone) {
		try {
			await runCardSystemActions(
				"station",
				{
					timezone,
					previousTimezone,
					skipSystemActions: dependencies.skipSystemActions,
				},
				dependencies.runner,
			);
		} catch {
			warnings.push(
				`The station's timezone couldn't be set to ${timezone}. Check it on the Station card.`,
			);
		}
	}
	try {
		const start = await startStationServices(
			{ skipSystemActions: dependencies.skipSystemActions },
			dependencies.runner,
		);
		if (start.skipped) warnings.push(NEEDS_RESTART);
	} catch {
		warnings.push(NEEDS_RESTART);
	}
	return warnings.join(" ") || null;
}

async function pauseStation(dependencies: RestoreDependencies) {
	try {
		await stopStationServices(
			{ skipSystemActions: dependencies.skipSystemActions },
			dependencies.runner,
		);
	} catch (error) {
		console.error("[data] could not pause recording for a restore:", error);
	}
}

export function applyStagedRestore(
	id: string,
	paths: DataPaths,
	dependencies: RestoreDependencies = {},
): Promise<RestoreOutcome> {
	return exclusively(async () => {
		const staged = await readStagedPreview(paths);
		if (!staged || staged.id !== id)
			throw new RestoreRefused(
				"That backup is no longer waiting to be restored. Choose the file again.",
				409,
			);
		if (await readSafetyCopy(paths))
			throw new RestoreRefused(SAFETY_COPY_EXISTS, 409);

		const payload = payloadDir(paths);
		const safety = safetyDir(paths);
		const incomingClips = path.join(payload, ...CLIPS_DIR.split("/"));
		const clipsIncluded = await pathExists(incomingClips);
		const previousTimezone = paths.timezone ?? (await currentTimezone());

		await writeSafetyCopy(paths, clipsIncluded);
		await pauseStation(dependencies);

		let restoreTimezone = previousTimezone;
		let undoClips: (() => Promise<void>) | null = null;
		let databaseReplaced = false;
		let settingsTouched = false;
		try {
			replaceDatabaseContents(
				paths.databasePath,
				path.join(payload, ...DATABASE_PATH.split("/")),
			);
			databaseReplaced = true;
			if (clipsIncluded) {
				undoClips = await swapClips(
					paths,
					incomingClips,
					path.join(safety, ...CLIPS_DIR.split("/")),
				);
			}
			settingsTouched = true;
			const settings = await applySettings(payload, paths);
			restoreTimezone = settings.station.timezone;
			await applySpeciesLists(payload, paths, false);
		} catch (error) {
			console.error("[data] restore failed, putting the station back:", error);
			const putBack: (() => Promise<void> | void)[] = [];
			if (settingsTouched) {
				putBack.push(() => applySettings(safety, paths).then(() => {}));
				putBack.push(() => applySpeciesLists(safety, paths, true));
			}
			if (undoClips) putBack.push(undoClips);
			if (databaseReplaced)
				putBack.push(() =>
					replaceDatabaseContents(
						paths.databasePath,
						path.join(safety, DATABASE_PATH),
					),
				);
			let fullyPutBack = true;
			for (const step of putBack) {
				try {
					await step();
				} catch (rollbackError) {
					fullyPutBack = false;
					console.error("[data] a rollback step failed:", rollbackError);
				}
			}
			await resumeStation(previousTimezone, previousTimezone, dependencies);
			if (fullyPutBack) await rm(safety, { recursive: true, force: true });
			throw new RestoreRefused(
				fullyPutBack
					? "The restore failed, so the station was put back as it was."
					: "The restore failed and part of the station couldn't be put back. The safety copy was kept, so try Undo restore.",
				500,
			);
		}

		const warning = await resumeStation(
			restoreTimezone,
			previousTimezone,
			dependencies,
		);
		await rm(stagingDir(paths), { recursive: true, force: true });
		return {
			message: `Restored ${staged.detections.toLocaleString("en-US")} detections.`,
			warning,
		};
	});
}

export function undoLastRestore(
	paths: DataPaths,
	dependencies: RestoreDependencies = {},
): Promise<RestoreOutcome> {
	return exclusively(async () => {
		const safetyCopy = await readSafetyCopy(paths);
		if (!safetyCopy)
			throw new RestoreRefused("There's no restore to undo.", 409);
		const safety = safetyDir(paths);
		const safetyClips = path.join(safety, ...CLIPS_DIR.split("/"));
		const discard = path.join(paths.workDir, "discard");
		const previousTimezone = paths.timezone ?? (await currentTimezone());
		await rm(discard, { recursive: true, force: true });
		await pauseStation(dependencies);

		let restoredTimezone = previousTimezone;
		try {
			replaceDatabaseContents(
				paths.databasePath,
				path.join(safety, DATABASE_PATH),
			);
			if (await pathExists(safetyClips))
				await swapClips(paths, safetyClips, discard);
			const settings = await applySettings(safety, paths);
			restoredTimezone = settings.station.timezone;
			await applySpeciesLists(safety, paths, true);
		} catch (error) {
			console.error("[data] undoing the restore failed:", error);
			await resumeStation(previousTimezone, previousTimezone, dependencies);
			throw new RestoreRefused(
				"The undo didn't finish. The safety copy was kept, so you can try again.",
				500,
			);
		}

		const warning = await resumeStation(
			restoredTimezone,
			previousTimezone,
			dependencies,
		);
		await rm(discard, { recursive: true, force: true });
		await rm(safety, { recursive: true, force: true });
		return { message: "The station is back as it was.", warning };
	});
}

export function deleteSafetyCopy(paths: DataPaths): Promise<void> {
	return exclusively(() =>
		rm(safetyDir(paths), { recursive: true, force: true }),
	);
}
