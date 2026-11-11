import "@tanstack/react-start/server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import type { DataPaths } from "./data-backup.server.ts";

const LOG_FILE = "last-backup.json";

const backupLogSchema = z.object({ at: z.number().int().positive() });

function logPath(paths: Pick<DataPaths, "workDir">) {
	return path.join(paths.workDir, LOG_FILE);
}

export async function recordBackup(
	paths: Pick<DataPaths, "workDir">,
	nowMs = Date.now(),
): Promise<void> {
	await mkdir(paths.workDir, { recursive: true });
	await writeFile(logPath(paths), JSON.stringify({ at: nowMs }));
}

export async function readLastBackupMs(
	paths: Pick<DataPaths, "workDir">,
): Promise<number | null> {
	try {
		const parsed = backupLogSchema.safeParse(
			JSON.parse(await readFile(logPath(paths), "utf8")),
		);
		return parsed.success ? parsed.data.at : null;
	} catch {
		return null;
	}
}
