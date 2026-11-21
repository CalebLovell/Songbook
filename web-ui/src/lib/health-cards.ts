import { formatBytes } from "~/lib/data-backup-format.ts";
import {
	BOOT_GRACE_SECONDS,
	type CheckState,
	describeToDo,
	type FullDiskAction,
	type PowerState,
	type StationHealth,
} from "~/lib/health-data.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";
import {
	availableUpdate,
	type UpdateState,
	updateBusy,
} from "~/lib/updates-data.ts";

export type HealthTone = "ok" | "problem" | "warning" | "setup" | "unknown";

export type HealthCardId =
	| "audio"
	| "model"
	| "name"
	| "location"
	| "power"
	| "updates"
	| "backups"
	| "storage";

export type HealthAction =
	| { kind: "restart-birdnet"; primary: boolean }
	| { kind: "tune-detection" }
	| { kind: "restore-backup"; primary: boolean }
	| { kind: "edit-name"; primary: boolean }
	| { kind: "edit-location"; primary: boolean; check?: true }
	| { kind: "download-backup" }
	| { kind: "install-update"; version: string }
	| { kind: "check-updates"; busy: boolean }
	| { kind: "check-audio" }
	| { kind: "reboot" }
	| { kind: "poweroff" };

export type HealthCardView = {
	id: HealthCardId;
	title: string;
	tone: HealthTone;
	figure: string | null;
	details: string[];
	problem: { title: string; detail: string } | null;
	meter: { usedPercent: number; threshold: number | null } | null;
	actions: HealthAction[];
	automaticUpdates?: true;
	info?: string[];
};

export type HealthAttention = { count: number; broken: boolean; label: string };

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const STALE_BACKUP_SECONDS = 30 * DAY;
const BACKUP_WORTHY_HISTORY_DAYS = 30;
const NOT_KNOWN = "Not known";

function unit(value: number, name: string) {
	return `${value} ${name}${value === 1 ? "" : "s"}`;
}

export function formatSpan(seconds: number): string {
	if (seconds < MINUTE) return "under a minute";
	if (seconds < HOUR) return unit(Math.floor(seconds / MINUTE), "minute");
	if (seconds < DAY) {
		const hours = Math.floor(seconds / HOUR);
		const minutes = Math.floor((seconds % HOUR) / MINUTE);
		return minutes
			? `${unit(hours, "hour")}, ${unit(minutes, "minute")}`
			: unit(hours, "hour");
	}
	const days = Math.floor(seconds / DAY);
	const hours = Math.floor((seconds % DAY) / HOUR);
	return hours
		? `${unit(days, "day")}, ${unit(hours, "hour")}`
		: unit(days, "day");
}

export function formatAge(seconds: number): string {
	return seconds < MINUTE
		? `${unit(seconds, "second")} ago`
		: formatTimeAgo(seconds * 1000);
}

function toneFor(state: CheckState, settingUp: boolean): HealthTone {
	if (state === "healthy") return "ok";
	if (state === "unknown") return "unknown";
	return settingUp ? "setup" : "problem";
}

function coordinate(value: number) {
	return value.toFixed(4).replace("-", "−");
}

function copyFor(toDo: Parameters<typeof describeToDo>[0]) {
	const { title, detail } = describeToDo(toDo);
	return { title, detail };
}

function waitingDetail(health: StationHealth, otherwise: string) {
	return health.checks.uptimeSeconds < BOOT_GRACE_SECONDS
		? "Checked once the station has been up for 5 minutes."
		: otherwise;
}

function decibels(value: number) {
	return `${Math.round(value)} dB`.replace("-", "−");
}

function audioFigure(audio: StationHealth["checks"]["audio"]) {
	if (audio.source === "stream") return "Network stream";
	const microphones = audio.microphones ?? [];
	if (microphones.length === 1) return microphones[0].name;
	return microphones.length > 1 ? `${microphones.length} microphones` : null;
}

function audioDetails(audio: StationHealth["checks"]["audio"]) {
	const details: string[] = [];
	const microphones = audio.microphones ?? [];
	if (audio.source === "microphone" && microphones.length > 1)
		details.push(
			`Plugged in: ${microphones.map((each) => each.name).join(", ")}.`,
		);
	if (audio.peakDb !== null && audio.problem?.kind !== "silent")
		details.push(`Hearing sound, peaking at ${decibels(audio.peakDb)}.`);
	if (audio.ageSeconds !== null && audio.problem?.kind !== "stopped")
		details.push(`Last recording ${formatAge(audio.ageSeconds)}.`);
	return details;
}

function audioCard(health: StationHealth): HealthCardView {
	const { audio } = health.checks;
	const { problem } = audio;
	const details = audioDetails(audio);
	return {
		id: "audio",
		title: "Audio input",
		tone: toneFor(audio.state, health.settingUp),
		figure:
			problem?.kind === "no-microphone"
				? null
				: (audioFigure(audio) ??
					(audio.state === "unknown" ? NOT_KNOWN : null)),
		details:
			audio.state === "unknown" && details.length === 0
				? [waitingDetail(health, "The recordings folder couldn't be read.")]
				: details,
		problem: problem ? copyFor({ kind: "audio", problem }) : null,
		meter: null,
		actions: problem ? [{ kind: "check-audio" }] : [],
	};
}

function modelCard(health: StationHealth): HealthCardView {
	const { analyzer } = health.checks;
	const failing = analyzer.state === "failing";
	const model = analyzer.model ?? "BirdNET";
	return {
		id: "model",
		title: "BirdNET model",
		info: [
			"BirdNET is the model that listens to the microphone and names the birds in each few seconds of audio.",
		],
		tone: toneFor(analyzer.state, health.settingUp),
		figure:
			analyzer.state === "unknown"
				? NOT_KNOWN
				: analyzer.state === "healthy"
					? analyzer.runningSeconds !== null
						? `Running for ${formatSpan(analyzer.runningSeconds)}`
						: "Running"
					: null,
		details:
			analyzer.state === "unknown"
				? [waitingDetail(health, "Its service couldn't be checked from here.")]
				: [`${model} is checking every recording for birds.`],
		problem: failing ? copyFor({ kind: "analyzer" }) : null,
		meter: null,
		actions: [
			{ kind: "restart-birdnet", primary: failing },
			{ kind: "tune-detection" },
		],
	};
}

function nameCard(health: StationHealth): HealthCardView {
	const { name } = health.checks;
	const failing = name.state === "failing";
	const isDefault = name.state === "default";
	return {
		id: "name",
		title: "Name",
		tone:
			name.state === "default"
				? "warning"
				: toneFor(name.state, health.settingUp),
		figure:
			name.state === "unknown"
				? NOT_KNOWN
				: name.state === "healthy" || isDefault
					? name.name
					: null,
		details:
			name.state === "unknown"
				? ["The settings file couldn't be read."]
				: ["Shown to visitors at the top of every page."],
		problem: failing
			? copyFor({ kind: "name" })
			: isDefault
				? {
						title: "The station has the default name",
						detail:
							"Every new station starts with this name. Change it to one of your own if you like.",
					}
				: null,
		meter: null,
		actions: [{ kind: "edit-name", primary: failing }],
	};
}

function locationProblem(location: StationHealth["checks"]["location"]) {
	if (location.state === "failing") return copyFor({ kind: "location" });
	if (location.state === "guessed")
		return copyFor({
			kind: "location-guessed",
			place: location.place,
			timezone: location.timezone,
		});
	if (location.timezoneFits === false && location.timezone)
		return copyFor({ kind: "timezone", timezone: location.timezone });
	return null;
}

function locationTone(health: StationHealth): HealthTone {
	const { location } = health.checks;
	if (location.state === "guessed") return "setup";
	if (location.state === "healthy" && location.timezoneFits === false)
		return "warning";
	return toneFor(location.state, health.settingUp);
}

function locationCard(health: StationHealth): HealthCardView {
	const { location } = health.checks;
	const guessed = location.state === "guessed";
	const known =
		(location.state === "healthy" || guessed) &&
		location.latitude !== null &&
		location.longitude !== null;
	const details = known
		? location.timezone
			? [`Time zone ${location.timezone.replaceAll("_", " ")}.`]
			: []
		: location.state === "unknown"
			? ["The settings file couldn't be read."]
			: [];
	const problem = locationProblem(location);
	return {
		id: "location",
		title: "Location",
		tone: locationTone(health),
		figure: known
			? `${coordinate(location.latitude as number)}, ${coordinate(location.longitude as number)}`
			: location.state === "unknown"
				? NOT_KNOWN
				: null,
		details,
		problem,
		meter: null,
		actions: [
			location.state === "failing"
				? { kind: "edit-location", primary: true }
				: problem
					? { kind: "edit-location", primary: true, check: true }
					: { kind: "edit-location", primary: false },
		],
	};
}

const POWER_PROBLEMS: Partial<
	Record<PowerState, { title: string; detail: string }>
> = {
	low: {
		title: "The power supply is too weak",
		detail:
			"The Pi is short of power right now, which can corrupt its memory card. Use the official power supply.",
	},
	dipped: {
		title: "The power supply dipped",
		detail:
			"The Pi ran short of power since it started. If it happens again, use the official power supply.",
	},
};

function powerCard(health: StationHealth): HealthCardView {
	const { power, uptimeSeconds } = health.checks;
	return {
		id: "power",
		title: "Power supply",
		tone:
			power.state === "steady"
				? "ok"
				: power.state === "unknown"
					? "unknown"
					: "warning",
		figure:
			power.state === "steady"
				? "Steady"
				: power.state === "unknown"
					? NOT_KNOWN
					: null,
		details:
			power.state === "unknown"
				? ["This computer doesn't report its power supply."]
				: [`No dips since the Pi started ${formatSpan(uptimeSeconds)} ago.`],
		problem: POWER_PROBLEMS[power.state] ?? null,
		meter: null,
		actions: [{ kind: "reboot" }, { kind: "poweroff" }],
	};
}

function backupsCard(health: StationHealth): HealthCardView {
	const { ageSeconds, historyDays } = health.checks.backups;
	const base = { id: "backups" as const, title: "Backups", meter: null };
	if (health.settingUp)
		return {
			...base,
			tone: "setup",
			figure: null,
			details: [],
			problem: {
				title: "An old station's data can be restored here",
				detail:
					"A backup from an older station brings over every detection, review and setting.",
			},
			actions: [{ kind: "restore-backup", primary: false }],
		};
	if (ageSeconds === null && (historyDays ?? 0) < BACKUP_WORTHY_HISTORY_DAYS)
		return {
			...base,
			tone: "ok",
			figure: "No backup yet",
			details: [
				historyDays === null
					? "Nothing to back up until your station hears its first bird."
					: "Worth downloading one once your station has a month of detections.",
			],
			problem: null,
			actions: [
				{ kind: "download-backup" },
				{ kind: "restore-backup", primary: false },
			],
		};
	if (ageSeconds === null)
		return {
			...base,
			tone: "warning",
			figure: "No backup yet",
			details: [
				"A backup keeps your detections safe if the memory card fails.",
			],
			problem: null,
			actions: [
				{ kind: "download-backup" },
				{ kind: "restore-backup", primary: false },
			],
		};
	const stale = ageSeconds > STALE_BACKUP_SECONDS;
	return {
		...base,
		tone: stale ? "warning" : "ok",
		figure: `Last backup ${formatTimeAgo(ageSeconds * 1000)}`,
		details: [],
		problem: stale
			? {
					title: "Your last backup is over a month old",
					detail: "Detections since then aren't in any backup.",
				}
			: null,
		actions: [
			{ kind: "download-backup" },
			{ kind: "restore-backup", primary: false },
		],
	};
}

function storageInfo(threshold: number | null, action: FullDiskAction): string {
	const rule =
		threshold === null
			? "When the disk is nearly full, the oldest clips are removed to make room, unless the station is set to keep them."
			: action === "keep"
				? `This station is set to keep every clip, so it stops recording when the disk reaches ${threshold}% full.`
				: `When the disk reaches ${threshold}% full, the oldest clips are removed to make room.`;
	return `Audio clips take up most of the space. ${rule} Detection records are always kept.`;
}

function storageCard(health: StationHealth): HealthCardView {
	const { storage } = health.checks;
	const disk = health.toDos.find((toDo) => toDo.kind === "disk");
	const failing = storage.state === "failing" && disk !== undefined;
	const used =
		storage.usedPercent !== null ? Math.ceil(storage.usedPercent) : null;
	const free =
		storage.freeBytes !== null
			? `${formatBytes(storage.freeBytes)} free`
			: null;
	const rule =
		storage.threshold !== null
			? storage.action === "keep"
				? `Recording stops at ${storage.threshold}%.`
				: `Old recordings are removed past ${storage.threshold}%.`
			: null;
	return {
		id: "storage",
		title: "Storage",
		info: [storageInfo(storage.threshold, storage.action)],
		tone: toneFor(storage.state, health.settingUp),
		figure:
			used !== null ? `${used}% used${free ? ` · ${free}` : ""}` : NOT_KNOWN,
		details:
			used === null ? ["The disk couldn't be read."] : rule ? [rule] : [],
		problem: failing ? copyFor(disk) : null,
		meter:
			used !== null
				? { usedPercent: used, threshold: storage.threshold }
				: null,
		actions: [],
	};
}

function updatesCard(
	updates: UpdateState | null,
	nowMs: number,
): HealthCardView {
	const base = {
		id: "updates" as const,
		title: "Updates",
		meter: null,
		info: [
			"Every night the station checks for a new Songbook release. With automatic updates on, it installs the release then. Otherwise the release waits here until Install is pressed.",
		],
	};
	if (!updates)
		return {
			...base,
			tone: "unknown",
			figure: NOT_KNOWN,
			details: ["Looking up the installed version."],
			problem: null,
			actions: [],
		};
	const installed = updates.installed?.version ?? null;
	const busy = updateBusy(updates);
	const check: HealthAction = { kind: "check-updates", busy };
	if (!updates.managed)
		return {
			...base,
			tone: "unknown",
			figure: "Development copy",
			details: ["Not installed from a release, so it doesn't update itself."],
			problem: null,
			actions: [],
		};
	const managed = { ...base, automaticUpdates: true as const };
	if (updates.state === "updating")
		return {
			...managed,
			tone: "warning",
			figure: `Installing ${updates.target ?? "an update"}…`,
			details: [
				"Recording stops for about a minute, and this page comes back when the station does.",
			],
			problem: null,
			actions: [],
		};
	if (updates.state === "failed")
		return {
			...managed,
			tone: "warning",
			figure: installed ? `Songbook ${installed}` : null,
			details: [],
			problem: {
				title: "The last update didn't finish",
				detail:
					updates.message ?? "Check again to see where the station stands.",
			},
			actions: [check],
		};
	const offered = availableUpdate(updates);
	if (offered)
		return {
			...managed,
			tone: "warning",
			figure: installed ? `Songbook ${installed}` : null,
			details: [],
			problem: {
				title: `Songbook ${offered} is out`,
				detail:
					"Recording stops for about a minute while it installs. If the new version doesn't start, the station goes back to this one.",
			},
			actions: [{ kind: "install-update", version: offered }],
		};
	const checked = updates.checkedAt
		? Date.parse(updates.checkedAt)
		: Number.NaN;
	return {
		...managed,
		tone: "ok",
		figure: installed ? `Songbook ${installed}` : "Up to date",
		details: [
			Number.isNaN(checked)
				? "Checked for a newer version every night."
				: `Up to date. Checked ${formatTimeAgo(Math.max(0, nowMs - checked))}.`,
		],
		problem: null,
		actions: [check],
	};
}

export function healthCards(
	health: StationHealth,
	updates: UpdateState | null = null,
	nowMs = Date.now(),
): HealthCardView[] {
	return [
		nameCard(health),
		locationCard(health),
		audioCard(health),
		powerCard(health),
		modelCard(health),
		storageCard(health),
		updatesCard(updates, nowMs),
		backupsCard(health),
	];
}

const NEEDS_A_LOOK: HealthTone[] = ["problem", "warning", "setup"];

export function healthAttention(
	cards: HealthCardView[],
): HealthAttention | null {
	const needing = cards.filter((card) => NEEDS_A_LOOK.includes(card.tone));
	if (needing.length === 0) return null;
	const count = needing.length;
	return {
		count,
		broken: needing.some((card) => card.tone === "problem"),
		label: `${count} ${count === 1 ? "needs" : "need"} a look`,
	};
}
