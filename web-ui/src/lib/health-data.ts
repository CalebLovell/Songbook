export type CheckState = "healthy" | "failing" | "unknown";

export type NameState = CheckState | "default";

export type LocationState = CheckState | "guessed";

export const DEFAULT_SITE_NAME = "Backyard Station";

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

export type AudioSource = "microphone" | "stream";

export type Microphone = { card: number; id: string; name: string };

export type AudioProblem =
	| { kind: "no-microphone" }
	| { kind: "device-missing"; device: string }
	| { kind: "stopped" }
	| { kind: "silent"; source: AudioSource };

export type StationChecks = {
	uptimeSeconds: number;
	audio: {
		state: CheckState;
		ageSeconds: number | null;
		source: AudioSource;
		microphones: Microphone[] | null;
		peakDb: number | null;
		problem: AudioProblem | null;
	};
	analyzer: {
		state: CheckState;
		runningSeconds: number | null;
		model: string | null;
	};
	name: { state: NameState; name: string | null };
	location: {
		state: LocationState;
		latitude: number | null;
		longitude: number | null;
		timezone: string | null;
		place: string | null;
		timezoneFits: boolean | null;
	};
	power: { state: PowerState };
	backups: { ageSeconds: number | null; historyDays: number | null };
	storage: {
		state: CheckState;
		usedPercent: number | null;
		freeBytes: number | null;
		threshold: number | null;
		action: FullDiskAction;
	};
};

export type StationToDo =
	| { kind: "audio"; problem: AudioProblem }
	| { kind: "analyzer" }
	| { kind: "location" }
	| {
			kind: "location-guessed";
			place: string | null;
			timezone: string | null;
	  }
	| { kind: "timezone"; timezone: string }
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
	audioSource: AudioSource;
	recordingDevice: string;
	microphones: Microphone[] | null;
	soundPeak: number | null;
	analyzer: ServiceState | null;
	latitude: string | undefined;
	longitude: string | undefined;
	locationSource?: string;
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

export function checkRecordingFlow({
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

const SILENT_PEAK = 2 / 32_768;
const SYSTEM_DEVICES = new Set(["", "default", "pulse", "sysdefault"]);

export function namedCard(device: string): string | null {
	const trimmed = device.trim();
	if (SYSTEM_DEVICES.has(trimmed)) return null;
	const match = /^[a-z_]+:(?:CARD=)?([^,]+)/i.exec(trimmed);
	return match ? match[1] : null;
}

function deviceConnected(card: string, microphones: Microphone[]) {
	return microphones.some((each) =>
		/^\d+$/.test(card) ? each.card === Number(card) : each.id === card,
	);
}

export function audioProblem(
	readings: Pick<
		StationReadings,
		| "nowMs"
		| "uptimeSeconds"
		| "audioChangedMs"
		| "recordingLengthSeconds"
		| "audioSource"
		| "recordingDevice"
		| "microphones"
		| "soundPeak"
	>,
): AudioProblem | null {
	const { audioSource, microphones, recordingDevice, soundPeak } = readings;
	if (audioSource === "microphone" && microphones !== null) {
		if (microphones.length === 0) return { kind: "no-microphone" };
		const card = namedCard(recordingDevice);
		if (card !== null && !deviceConnected(card, microphones))
			return { kind: "device-missing", device: recordingDevice.trim() };
	}
	if (checkRecordingFlow(readings) === "failing") return { kind: "stopped" };
	if (soundPeak !== null && soundPeak < SILENT_PEAK)
		return { kind: "silent", source: audioSource };
	return null;
}

export function checkAudio(
	readings: Parameters<typeof audioProblem>[0],
): CheckState {
	if (audioProblem(readings)) return "failing";
	const flowing =
		readings.soundPeak !== null || checkRecordingFlow(readings) === "healthy";
	const heard =
		readings.audioSource === "stream" ||
		(readings.microphones?.length ?? 0) > 0;
	return flowing && heard ? "healthy" : "unknown";
}

export function peakDb(peak: number | null): number | null {
	return peak === null || peak <= 0 ? null : 20 * Math.log10(peak);
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
	locationSource,
}: Pick<
	StationReadings,
	"latitude" | "longitude" | "locationSource"
>): LocationState {
	if (latitude === undefined || longitude === undefined) return "unknown";
	const lat = Number(latitude);
	const lon = Number(longitude);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "unknown";
	if (lat === 0 && lon === 0) return "failing";
	return locationSource?.trim() === "ip" ? "guessed" : "healthy";
}

const HOURS_PER_DEGREE = 1 / 15;
const TIMEZONE_FIT_HOURS = 3.5;

export function timezoneOffsetHours(
	timezone: string,
	atMs: number,
): number | null {
	try {
		const name = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			timeZoneName: "longOffset",
		})
			.formatToParts(atMs)
			.find((part) => part.type === "timeZoneName")?.value;
		const match = name ? /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name) : null;
		if (!match) return null;
		if (!match[1]) return 0;
		const hours = Number(match[2]) + Number(match[3]) / 60;
		return match[1] === "-" ? -hours : hours;
	} catch {
		return null;
	}
}

export function timezoneFitsLongitude(
	timezone: string,
	longitude: number,
	atMs: number,
): boolean | null {
	const offset = timezoneOffsetHours(timezone, atMs);
	if (offset === null || !Number.isFinite(longitude)) return null;
	const gap = Math.abs(offset - longitude * HOURS_PER_DEGREE) % 24;
	return Math.min(gap, 24 - gap) <= TIMEZONE_FIT_HOURS;
}

export function checkName({
	siteName,
	hostname,
}: Pick<StationReadings, "siteName" | "hostname">): NameState {
	if (siteName === undefined) return "unknown";
	const name = siteName.trim().toLowerCase();
	if (name === "") return "failing";
	return name === DEFAULT_SITE_NAME.toLowerCase() ||
		name === hostname.trim().toLowerCase()
		? "default"
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
	return (
		checks.name.state === "failing" ||
		checks.location.state === "failing" ||
		checks.location.state === "guessed"
	);
}

export function stationToDos(readings: StationReadings): StationToDo[] {
	const toDos: StationToDo[] = [];
	if (checkLocation(readings) === "failing") toDos.push({ kind: "location" });
	const audio = audioProblem(readings);
	if (audio) toDos.push({ kind: "audio", problem: audio });
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
		return `The disk is ${usedPercent}% full, past the ${threshold}% where old recordings get removed, so removing them isn't keeping up. Free some space on the station, or move to a bigger SD card by downloading a backup and restoring it there.`;
	return usedPercent >= threshold
		? `The disk is ${usedPercent}% full, past the ${threshold}% where the station stops recording. Free some space on the station, or move to a bigger SD card by downloading a backup and restoring it there.`
		: `The disk is ${usedPercent}% full, and the station stops recording at ${threshold}%. Free some space on the station, or move to a bigger SD card by downloading a backup and restoring it there.`;
}

export function describeAudioProblem(problem: AudioProblem): ToDoCopy {
	switch (problem.kind) {
		case "no-microphone":
			return {
				title: "No microphone is plugged in",
				detail:
					"Plug a USB microphone into any USB port on the Pi. Until then the station records silence and can't hear any birds.",
			};
		case "device-missing":
			return {
				title: "The recording device isn't connected",
				detail: `Audio input is set to record from ${problem.device}, which isn't plugged in. Plug it back in, or change REC_CARD in the station configuration.`,
			};
		case "stopped":
			return {
				title: "No audio is arriving",
				detail:
					"The station hasn't saved a new recording in the last few minutes, so it can't hear any birds. Check that the microphone or stream is connected, then restart BirdNET.",
			};
		case "silent":
			return problem.source === "stream"
				? {
						title: "The stream is silent",
						detail:
							"Recordings from the network stream contain no sound at all. Check that the stream's source is running and sending audio.",
					}
				: {
						title: "The microphone isn't picking up any sound",
						detail:
							"It's plugged in, but its recordings are completely silent. Unplug it and plug it back in, or try another USB port or another microphone.",
					};
	}
}

export function describeToDo(toDo: StationToDo): ToDoCopy {
	switch (toDo.kind) {
		case "location":
			return {
				title: "The station's location isn't set",
				detail:
					"Latitude and longitude are both 0, so BirdNET can't tell which birds live nearby and will drop most detections. Enter where the station is.",
			};
		case "location-guessed":
			return {
				title: "The station's location was guessed",
				detail: `The location${toDo.place ? `, near ${toDo.place},` : ""} and the time zone${toDo.timezone ? `, ${toDo.timezone.replaceAll("_", " ")},` : ""} were guessed from your internet connection, which can be miles off. BirdNET uses the location to decide which birds live nearby.`,
			};
		case "timezone":
			return {
				title: "The time zone doesn't fit the location",
				detail: `The station is on ${toDo.timezone.replaceAll("_", " ")}, which is hours away from the local time at its coordinates, so detection times are probably off. Pick the time zone where the station is.`,
			};
		case "name":
			return {
				title: "The station has no name",
				detail: "Visitors see the station's name at the top of every page.",
			};
		case "audio":
			return describeAudioProblem(toDo.problem);
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
