import "@tanstack/react-start/server-only";

import { readFile, stat, statfs } from "node:fs/promises";
import { hostname, uptime } from "node:os";
import path from "node:path";

import { extractedDir } from "~/lib/audio.server.ts";
import {
	dfUsedPercent,
	type StationHealth,
	stationToDos,
} from "~/lib/health-data.ts";
import {
	parseBirdnetConfig,
	resolveSettingsPath,
} from "~/lib/settings-config.server.ts";
import { SETTINGS_DEFAULTS } from "~/lib/settings-data.ts";
import { readAnalyzerState } from "~/lib/station-status.server.ts";

async function diskUsedPercent(): Promise<number | null> {
	try {
		return dfUsedPercent(await statfs(extractedDir()));
	} catch {
		return null;
	}
}

async function readConfig(): Promise<Record<string, string> | null> {
	try {
		return parseBirdnetConfig(await readFile(resolveSettingsPath(), "utf8"));
	} catch {
		return null;
	}
}

async function streamDataChangedMs(
	recsDir: string | undefined,
): Promise<number | null> {
	if (!recsDir) return null;
	try {
		return (await stat(path.join(recsDir, "StreamData"))).mtimeMs;
	} catch {
		return null;
	}
}

function positiveNumber(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	return value && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function loadStationHealth({
	uptimeSeconds = uptime(),
	nowMs = Date.now(),
}: {
	uptimeSeconds?: number;
	nowMs?: number;
} = {}): Promise<StationHealth> {
	const config = await readConfig();
	const [disk, audioChangedMs, analyzer] = await Promise.all([
		diskUsedPercent(),
		streamDataChangedMs(config?.RECS_DIR),
		readAnalyzerState(),
	]);
	return {
		diskUsedPercent: disk,
		toDos: stationToDos({
			nowMs,
			uptimeSeconds,
			audioChangedMs,
			recordingLengthSeconds: positiveNumber(
				config?.RECORDING_LENGTH,
				SETTINGS_DEFAULTS.recording.recordingLength,
			),
			analyzer,
			latitude: config?.LATITUDE,
			longitude: config?.LONGITUDE,
			siteName: config?.SITE_NAME,
			hostname: hostname(),
			diskUsedPercent: disk,
			purgeThreshold: config
				? positiveNumber(
						config.PURGE_THRESHOLD,
						SETTINGS_DEFAULTS.storage.purgeThreshold,
					)
				: null,
			fullDiskAction: config?.FULL_DISK === "keep" ? "keep" : "purge",
		}),
	};
}
