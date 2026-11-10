import "@tanstack/react-start/server-only";

import { createHash, randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { mkdir, open, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	PassThrough,
	pipeline as pipelineCallback,
	type Readable,
} from "node:stream";
import { pipeline } from "node:stream/promises";
import tar from "tar-stream";

import { extractedDir } from "./audio.server.ts";
import {
	BACKUP_FORMAT,
	BACKUP_FORMAT_VERSION,
	type BackupChecksums,
	type BackupManifest,
	type BackupSettings,
	backupSettingsSchema,
	CHECKSUMS_PATH,
	CLIPS_DIR,
	DATABASE_PATH,
	type DataSummary,
	MANIFEST_PATH,
	SETTINGS_PATH,
	SPECIES_LIST_FILES,
	SPECIES_LISTS_DIR,
} from "./data-backup-format.ts";
import { currentTimezone } from "./settings.server.ts";
import {
	readSettingsPageValues,
	resolveSettingsPath,
} from "./settings-config.server.ts";
import { resolveSpeciesListDirectory } from "./species-filter.server.ts";

export type DataPaths = {
	databasePath: string;
	extractedDir: string;
	settingsPath: string;
	speciesListDir: string;
	workDir: string;
	timezone?: string;
};

export function stationDataPaths(): DataPaths {
	const extracted = extractedDir();
	return {
		databasePath: path.resolve(
			process.env.BIRDNET_DB_PATH ?? "../scripts/birds.db",
		),
		extractedDir: extracted,
		settingsPath: resolveSettingsPath(),
		speciesListDir: resolveSpeciesListDirectory(),
		workDir: path.join(path.dirname(extracted), "Songbook-data"),
	};
}

export function snapshotDatabase(databasePath: string, destination: string) {
	const database = new DatabaseSync(databasePath, { readOnly: true });
	try {
		database.prepare("VACUUM INTO ?").run(destination);
	} finally {
		database.close();
	}
}

export async function readBackupSettings(
	paths: DataPaths,
): Promise<BackupSettings> {
	const values = await readSettingsPageValues(
		paths.settingsPath,
		paths.timezone ?? (await currentTimezone()),
	);
	return backupSettingsSchema.parse(values);
}

async function directoryEntries(directory: string): Promise<Dirent[]> {
	try {
		const entries = await readdir(directory, { withFileTypes: true });
		return entries.sort((a, b) => a.name.localeCompare(b.name));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
}

export async function* clipFiles(
	extracted: string,
): AsyncGenerator<{ archivePath: string; filePath: string }> {
	const byDate = path.join(extracted, "By_Date");
	for (const date of await directoryEntries(byDate)) {
		if (!date.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(date.name)) continue;
		const dateDir = path.join(byDate, date.name);
		for (const species of await directoryEntries(dateDir)) {
			if (!species.isDirectory()) continue;
			const speciesDir = path.join(dateDir, species.name);
			for (const file of await directoryEntries(speciesDir)) {
				if (!file.isFile()) continue;
				yield {
					archivePath: `${CLIPS_DIR}/${date.name}/${species.name}/${file.name}`,
					filePath: path.join(speciesDir, file.name),
				};
			}
		}
	}
}

function addBuffer(
	pack: tar.Pack,
	checksums: BackupChecksums,
	name: string,
	data: Buffer,
) {
	checksums[name] = {
		size: data.length,
		sha256: createHash("sha256").update(data).digest("hex"),
	};
	return new Promise<void>((resolve, reject) => {
		pack.entry({ name, size: data.length, mtime: new Date() }, data, (error) =>
			error ? reject(error) : resolve(),
		);
	});
}

async function addFile(
	pack: tar.Pack,
	checksums: BackupChecksums,
	name: string,
	filePath: string,
) {
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(filePath, "r");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
		throw error;
	}
	try {
		const info = await handle.stat();
		const hash = createHash("sha256");
		let entryDone: () => void = () => {};
		let entryFailed: (error: Error) => void = () => {};
		const finished = new Promise<void>((resolve, reject) => {
			entryDone = resolve;
			entryFailed = reject;
		});
		const entry = pack.entry(
			{ name, size: info.size, mtime: info.mtime },
			(error) => (error ? entryFailed(error) : entryDone()),
		);
		await Promise.all([
			pipeline(
				handle.createReadStream({ autoClose: false }),
				async function* (source) {
					for await (const chunk of source) {
						hash.update(chunk as Buffer);
						yield chunk;
					}
				},
				entry,
			),
			finished,
		]);
		checksums[name] = { size: info.size, sha256: hash.digest("hex") };
	} finally {
		await handle.close();
	}
}

async function writeBackup(
	pack: tar.Pack,
	output: PassThrough,
	paths: DataPaths,
	includeClips: boolean,
) {
	await mkdir(paths.workDir, { recursive: true });
	const snapshotPath = path.join(paths.workDir, `backup-${randomUUID()}.db`);
	const checksums: BackupChecksums = {};
	try {
		snapshotDatabase(paths.databasePath, snapshotPath);
		const settings = await readBackupSettings(paths);
		const manifest: BackupManifest = {
			format: BACKUP_FORMAT,
			formatVersion: BACKUP_FORMAT_VERSION,
			createdAt: new Date().toISOString(),
			stationName: settings.station.siteName,
			includesClips: includeClips,
		};
		await addBuffer(
			pack,
			checksums,
			MANIFEST_PATH,
			Buffer.from(JSON.stringify(manifest, null, "\t")),
		);
		await addBuffer(
			pack,
			checksums,
			SETTINGS_PATH,
			Buffer.from(JSON.stringify(settings, null, "\t")),
		);
		await addFile(pack, checksums, DATABASE_PATH, snapshotPath);
		await rm(snapshotPath, { force: true });
		for (const file of SPECIES_LIST_FILES) {
			await addFile(
				pack,
				checksums,
				`${SPECIES_LISTS_DIR}/${file}`,
				path.join(paths.speciesListDir, file),
			);
		}
		if (includeClips) {
			for await (const clip of clipFiles(paths.extractedDir)) {
				if (output.destroyed) throw new Error("Backup download stopped");
				await addFile(pack, checksums, clip.archivePath, clip.filePath);
			}
		}
		await addBuffer(
			pack,
			{},
			CHECKSUMS_PATH,
			Buffer.from(JSON.stringify(checksums)),
		);
		pack.finalize();
	} finally {
		await rm(snapshotPath, { force: true });
	}
}

export function createBackupStream(
	paths: DataPaths,
	includeClips: boolean,
): Readable {
	const pack = tar.pack();
	const output = new PassThrough();
	pipelineCallback(pack, output, () => {});
	writeBackup(pack, output, paths, includeClips).catch((error) => {
		if (!output.destroyed) console.error("[data] backup failed:", error);
		pack.destroy(error as Error);
		output.destroy(error as Error);
	});
	return output;
}

export function readDetectionFigures(databasePath: string) {
	const database = new DatabaseSync(databasePath, { readOnly: true });
	try {
		const totals = database
			.prepare(
				"SELECT COUNT(*) AS detections, MIN(Date) AS firstDate, MAX(Date) AS lastDate FROM detections",
			)
			.get() as {
			detections: number;
			firstDate: string | null;
			lastDate: string | null;
		};
		const species = database
			.prepare(
				"SELECT Sci_Name AS sciName, MIN(Com_Name) AS comName FROM detections GROUP BY Sci_Name ORDER BY comName",
			)
			.all() as { sciName: string; comName: string }[];
		return { ...totals, species };
	} finally {
		database.close();
	}
}

export async function readClipTotals(extracted: string) {
	let clipFileCount = 0;
	let clipBytes = 0;
	for await (const clip of clipFiles(extracted)) {
		try {
			const info = await stat(clip.filePath);
			clipFileCount += 1;
			clipBytes += info.size;
		} catch {}
	}
	return { clipFiles: clipFileCount, clipBytes };
}

export async function readJsonFile(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, "utf8"));
}

export async function readStationFigures(
	paths: DataPaths,
): Promise<Omit<DataSummary, "safetyCopy" | "staged">> {
	const figures = readDetectionFigures(paths.databasePath);
	const [info, clips] = await Promise.all([
		stat(paths.databasePath),
		readClipTotals(paths.extractedDir),
	]);
	return { ...figures, ...clips, databaseBytes: info.size };
}
