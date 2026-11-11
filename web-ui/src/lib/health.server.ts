import "@tanstack/react-start/server-only";

import { readFile, stat, statfs } from "node:fs/promises";
import { hostname, uptime } from "node:os";
import path from "node:path";

import { extractedDir } from "~/lib/audio.server.ts";
import { readLastBackupMs } from "~/lib/backup-log.server.ts";
import { stationDataPaths } from "~/lib/data-backup.server.ts";
import {
	checkAnalyzer,
	checkAudio,
	checkDisk,
	checkLocation,
	checkName,
	checkPower,
	dfUsedPercent,
	formatModelName,
	isSettingUp,
	type ServiceState,
	type StationChecks,
	type StationHealth,
	type StationReadings,
	stationToDos,
} from "~/lib/health-data.ts";
import { readPiReadings } from "~/lib/pi-readings.server.ts";
import { currentTimezone } from "~/lib/settings.server.ts";
import {
	parseBirdnetConfig,
	resolveSettingsPath,
} from "~/lib/settings-config.server.ts";
import { SETTINGS_DEFAULTS } from "~/lib/settings-data.ts";
import { readAnalyzerState } from "~/lib/station-status.server.ts";

type DiskReading = { usedPercent: number | null; freeBytes: number | null };

async function readDisk(): Promise<DiskReading> {
	try {
		const disk = await statfs(extractedDir());
		return {
			usedPercent: dfUsedPercent(disk),
			freeBytes: disk.bavail * disk.bsize,
		};
	} catch {
		return { usedPercent: null, freeBytes: null };
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

async function lastBackupMs(): Promise<number | null> {
	try {
		return await readLastBackupMs(stationDataPaths());
	} catch {
		return null;
	}
}

function positiveNumber(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	return value && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function finiteNumber(value: string | undefined): number | null {
	const parsed = Number(value);
	return value !== undefined && value.trim() !== "" && Number.isFinite(parsed)
		? parsed
		: null;
}

function secondsSince(nowMs: number, thenMs: number | null): number | null {
	return thenMs === null
		? null
		: Math.max(0, Math.round((nowMs - thenMs) / 1000));
}

async function readTimezone(): Promise<string | null> {
	try {
		return await currentTimezone();
	} catch {
		return null;
	}
}

function analyzerRunningSeconds(
	analyzer: ServiceState | null,
	uptimeSeconds: number,
): number | null {
	if (analyzer?.activeState !== "active" || !analyzer.activeEnterMonotonicUs)
		return null;
	return Math.max(
		0,
		Math.round(uptimeSeconds - analyzer.activeEnterMonotonicUs / 1_000_000),
	);
}

export async function loadStationHealth({
	uptimeSeconds = uptime(),
	nowMs = Date.now(),
}: {
	uptimeSeconds?: number;
	nowMs?: number;
} = {}): Promise<StationHealth> {
	const config = await readConfig();
	const [disk, audioChangedMs, analyzer, pi, backupMs, timezone] =
		await Promise.all([
			readDisk(),
			streamDataChangedMs(config?.RECS_DIR),
			readAnalyzerState(),
			readPiReadings(),
			lastBackupMs(),
			readTimezone(),
		]);
	const readings: StationReadings = {
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
		diskUsedPercent: disk.usedPercent,
		purgeThreshold: config
			? positiveNumber(
					config.PURGE_THRESHOLD,
					SETTINGS_DEFAULTS.storage.purgeThreshold,
				)
			: null,
		fullDiskAction: config?.FULL_DISK === "keep" ? "keep" : "purge",
	};
	const latitude = finiteNumber(config?.LATITUDE);
	const longitude = finiteNumber(config?.LONGITUDE);
	const locationState = checkLocation(readings);
	const checks: StationChecks = {
		uptimeSeconds: Math.round(uptimeSeconds),
		audio: {
			state: checkAudio(readings),
			ageSeconds: secondsSince(nowMs, audioChangedMs),
			source: config?.RTSP_STREAM?.trim() ? "stream" : "microphone",
		},
		analyzer: {
			state: checkAnalyzer(readings),
			runningSeconds: analyzerRunningSeconds(analyzer, uptimeSeconds),
			model: formatModelName(config?.MODEL),
		},
		name: {
			state: checkName(readings),
			name: config?.SITE_NAME?.trim() || null,
		},
		location: {
			state: locationState,
			latitude,
			longitude,
			timezone,
		},
		power: { state: checkPower(pi.underVoltage) },
		backups: { ageSeconds: secondsSince(nowMs, backupMs) },
		storage: {
			state: checkDisk(readings),
			usedPercent: disk.usedPercent,
			freeBytes: disk.freeBytes,
			threshold: readings.purgeThreshold,
			action: readings.fullDiskAction,
		},
	};
	return {
		diskUsedPercent: disk.usedPercent,
		toDos: stationToDos(readings),
		checks,
		settingUp: isSettingUp(checks),
	};
}
