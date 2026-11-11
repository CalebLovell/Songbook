export type CheckState = "healthy" | "failing" | "unknown";

export type ServiceState = {
	loadState: string;
	activeState: string;
	activeEnterMonotonicUs?: number;
};

export type FullDiskAction = "purge" | "keep";

export type UnderVoltage = { now: boolean; sinceBoot: boolean };

export type PiReadings = {
	underVoltage: UnderVoltage | null;
};

export type PowerState = "steady" | "dipped" | "low" | "unknown";

export type StationChecks = {
	uptimeSeconds: number;
	audio: {
		state: CheckState;
		ageSeconds: number | null;
		source: "microphone" | "stream";
	};
	analyzer: {
		state: CheckState;
		runningSeconds: number | null;
		model: string | null;
	};
	name: { state: CheckState; name: string | null };
	location: {
		state: CheckState;
		latitude: number | null;
		longitude: number | null;
		timezone: string | null;
	};
	power: { state: PowerState };
	backups: { ageSeconds: number | null };
	storage: {
		state: CheckState;
		usedPercent: number | null;
		freeBytes: number | null;
		threshold: number | null;
		action: FullDiskAction;
	};
};

export type StationToDo =
	| { kind: "audio" }
	| { kind: "analyzer" }
	| { kind: "location" }
	| { kind: "name" }
	| {
			kind: "disk";
			usedPercent: number;
			threshold: number;
			action: FullDiskAction;
	  };

export type StationHealth = {
	diskUsedPercent: number | null;
	toDos: StationToDo[];
	checks: StationChecks;
	settingUp: boolean;
};

export type StationReadings = {
	nowMs: number;
	uptimeSeconds: number;
	audioChangedMs: number | null;
	recordingLengthSeconds: number;
	analyzer: ServiceState | null;
	latitude: string | undefined;
	longitude: string | undefined;
	siteName: string | undefined;
	hostname: string;
	diskUsedPercent: number | null;
	purgeThreshold: number | null;
	fullDiskAction: FullDiskAction;
};

export const BOOT_GRACE_SECONDS = 300;
const AUDIO_STALE_FLOOR_SECONDS = 300;
const AUDIO_STALE_RECORDINGS = 6;
const KEEP_WARNING_MARGIN = 5;
const PURGE_OVERRUN_MARGIN = 2;

export function audioStaleAfterSeconds(recordingLengthSeconds: number) {
	return Math.max(
		AUDIO_STALE_FLOOR_SECONDS,
		recordingLengthSeconds * AUDIO_STALE_RECORDINGS,
	);
}

export function checkAudio({
	nowMs,
	uptimeSeconds,
	audioChangedMs,
	recordingLengthSeconds,
}: Pick<
	StationReadings,
	"nowMs" | "uptimeSeconds" | "audioChangedMs" | "recordingLengthSeconds"
>): CheckState {
	if (audioChangedMs === null || uptimeSeconds < BOOT_GRACE_SECONDS)
		return "unknown";
	const ageSeconds = (nowMs - audioChangedMs) / 1000;
	return ageSeconds > audioStaleAfterSeconds(recordingLengthSeconds)
		? "failing"
		: "healthy";
}

export function checkAnalyzer({
	uptimeSeconds,
	analyzer,
}: Pick<StationReadings, "uptimeSeconds" | "analyzer">): CheckState {
	if (!analyzer || uptimeSeconds < BOOT_GRACE_SECONDS) return "unknown";
	if (analyzer.loadState !== "loaded") return "unknown";
	if (analyzer.activeState === "active") return "healthy";
	return analyzer.activeState === "inactive" ||
		analyzer.activeState === "failed"
		? "failing"
		: "unknown";
}

export function checkLocation({
	latitude,
	longitude,
}: Pick<StationReadings, "latitude" | "longitude">): CheckState {
	if (latitude === undefined || longitude === undefined) return "unknown";
	const lat = Number(latitude);
	const lon = Number(longitude);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "unknown";
	return lat === 0 && lon === 0 ? "failing" : "healthy";
}

export function checkName({
	siteName,
	hostname,
}: Pick<StationReadings, "siteName" | "hostname">): CheckState {
	if (siteName === undefined) return "unknown";
	const name = siteName.trim().toLowerCase();
	return name === "" || name === hostname.trim().toLowerCase()
		? "failing"
		: "healthy";
}

export function dfUsedPercent({
	blocks,
	bfree,
	bavail,
}: {
	blocks: number;
	bfree: number;
	bavail: number;
}): number | null {
	const used = blocks - bfree;
	const usable = used + bavail;
	return usable > 0 ? (used / usable) * 100 : null;
}

export function checkDisk({
	diskUsedPercent,
	purgeThreshold,
	fullDiskAction,
}: Pick<
	StationReadings,
	"diskUsedPercent" | "purgeThreshold" | "fullDiskAction"
>): CheckState {
	if (diskUsedPercent === null || purgeThreshold === null) return "unknown";
	const alarmAt =
		fullDiskAction === "keep"
			? purgeThreshold - KEEP_WARNING_MARGIN
			: Math.min(purgeThreshold + PURGE_OVERRUN_MARGIN, 99);
	return Math.ceil(diskUsedPercent) >= alarmAt ? "failing" : "healthy";
}

const UNDER_VOLTAGE_NOW = 0x1;
const UNDER_VOLTAGE_SINCE_BOOT = 0x10000;

export function parseThrottled(output: string): UnderVoltage | null {
	const match = /throttled=0x([0-9a-f]+)/i.exec(output);
	if (!match) return null;
	const bits = Number.parseInt(match[1], 16);
	return {
		now: (bits & UNDER_VOLTAGE_NOW) !== 0,
		sinceBoot: (bits & UNDER_VOLTAGE_SINCE_BOOT) !== 0,
	};
}

export function checkPower(underVoltage: UnderVoltage | null): PowerState {
	if (!underVoltage) return "unknown";
	if (underVoltage.now) return "low";
	return underVoltage.sinceBoot ? "dipped" : "steady";
}

export function formatModelName(model: string | undefined): string | null {
	const trimmed = model?.trim();
	if (!trimmed) return null;
	const version = /_V(\d+(?:\.\d+)*)/i.exec(trimmed)?.[1];
	if (/^BirdNET_GLOBAL/i.test(trimmed) && version) return `BirdNET ${version}`;
	return trimmed.replaceAll("_", " ");
}

export function isSettingUp(checks: Pick<StationChecks, "name" | "location">) {
	return checks.name.state === "failing" || checks.location.state === "failing";
}

export function stationToDos(readings: StationReadings): StationToDo[] {
	const toDos: StationToDo[] = [];
	if (checkLocation(readings) === "failing") toDos.push({ kind: "location" });
	if (checkAudio(readings) === "failing") toDos.push({ kind: "audio" });
	if (checkAnalyzer(readings) === "failing") toDos.push({ kind: "analyzer" });
	if (
		checkDisk(readings) === "failing" &&
		readings.diskUsedPercent !== null &&
		readings.purgeThreshold !== null
	) {
		toDos.push({
			kind: "disk",
			usedPercent: Math.ceil(readings.diskUsedPercent),
			threshold: readings.purgeThreshold,
			action: readings.fullDiskAction,
		});
	}
	if (checkName(readings) === "failing") toDos.push({ kind: "name" });
	return toDos;
}

export type ToDoCopy = {
	title: string;
	detail: string;
};

function diskDetail({
	usedPercent,
	threshold,
	action,
}: Extract<StationToDo, { kind: "disk" }>) {
	if (action === "purge")
		return `The disk is ${usedPercent}% full, past the ${threshold}% where old recordings get removed, so removing them isn't keeping up. Free some space on the station or keep fewer recordings.`;
	return usedPercent >= threshold
		? `The disk is ${usedPercent}% full, past the ${threshold}% where the station stops recording. Free some space on the station or change what happens when it fills.`
		: `The disk is ${usedPercent}% full, and the station stops recording at ${threshold}%. Free some space on the station or change what happens when it fills.`;
}

export function describeToDo(toDo: StationToDo): ToDoCopy {
	switch (toDo.kind) {
		case "location":
			return {
				title: "The station's location isn't set",
				detail:
					"Latitude and longitude are both 0, so BirdNET can't tell which birds live nearby and will drop most detections. Enter where the station is.",
			};
		case "name":
			return {
				title: "Give the station a name",
				detail:
					"It's still using the name the installer gave it. Choose one that visitors will see.",
			};
		case "audio":
			return {
				title: "No audio is arriving",
				detail:
					"The station hasn't saved a new recording in the last few minutes, so it can't hear any birds. Check that the microphone or stream is connected.",
			};
		case "analyzer":
			return {
				title: "Bird analysis has stopped",
				detail:
					"Recordings aren't being checked for birds, so nothing new will appear. Restart BirdNET to bring it back.",
			};
		case "disk":
			return {
				title: "The disk is nearly full",
				detail: diskDetail(toDo),
			};
	}
}
