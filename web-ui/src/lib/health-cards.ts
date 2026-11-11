import type { SettingsTab } from "~/components/settings/settings-index.ts";
import { formatBytes } from "~/lib/data-backup-format.ts";
import {
	BOOT_GRACE_SECONDS,
	type CheckState,
	describeToDo,
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
	| { kind: "setting"; tab: SettingsTab; label: string; primary: boolean }
	| { kind: "restart-birdnet"; primary: boolean }
	| { kind: "edit-name"; primary: boolean }
	| { kind: "edit-location"; primary: boolean }
	| { kind: "download-backup" }
	| { kind: "install-update"; version: string }
	| { kind: "check-updates"; busy: boolean }
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
};

export type HealthAttention = { count: number; broken: boolean; label: string };

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const STALE_BACKUP_SECONDS = 30 * DAY;
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

function setting(
	tab: SettingsTab,
	label: string,
	primary: boolean,
): HealthAction {
	return { kind: "setting", tab, label, primary };
}

function waitingDetail(health: StationHealth, otherwise: string) {
	return health.checks.uptimeSeconds < BOOT_GRACE_SECONDS
		? "Checked once the station has been up for 5 minutes."
		: otherwise;
}

function audioCard(health: StationHealth): HealthCardView {
	const { audio } = health.checks;
	const failing = audio.state === "failing";
	const source = audio.source === "stream" ? "network stream" : "microphone";
	return {
		id: "audio",
		title: "Audio input",
		tone: toneFor(audio.state, health.settingUp),
		figure:
			audio.state === "unknown"
				? NOT_KNOWN
				: audio.state === "healthy" && audio.ageSeconds !== null
					? `Last recording ${formatAge(audio.ageSeconds)}`
					: null,
		details:
			audio.state === "unknown"
				? [waitingDetail(health, "The recordings folder couldn't be read.")]
				: [`Recording from the ${source}.`],
		problem: failing ? copyFor({ kind: "audio" }) : null,
		meter: null,
		actions: failing ? [setting("audio-input", "Check audio input", true)] : [],
	};
}

function modelCard(health: StationHealth): HealthCardView {
	const { analyzer } = health.checks;
	const failing = analyzer.state === "failing";
	const model = analyzer.model ?? "BirdNET";
	return {
		id: "model",
		title: "BirdNET model",
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
		actions: [{ kind: "restart-birdnet", primary: failing }],
	};
}

function nameCard(health: StationHealth): HealthCardView {
	const { name } = health.checks;
	const failing = name.state === "failing";
	return {
		id: "name",
		title: "Name",
		tone: toneFor(name.state, health.settingUp),
		figure:
			name.state === "unknown"
				? NOT_KNOWN
				: name.state === "healthy"
					? name.name
					: null,
		details:
			name.state === "unknown"
				? ["The settings file couldn't be read."]
				: ["Shown to visitors at the top of every page."],
		problem: failing ? copyFor({ kind: "name" }) : null,
		meter: null,
		actions: [{ kind: "edit-name", primary: failing }],
	};
}

function locationCard(health: StationHealth): HealthCardView {
	const { location } = health.checks;
	const failing = location.state === "failing";
	const known =
		location.state === "healthy" &&
		location.latitude !== null &&
		location.longitude !== null;
	const details = known
		? location.timezone
			? [`Time zone ${location.timezone.replaceAll("_", " ")}.`]
			: []
		: location.state === "unknown"
			? ["The settings file couldn't be read."]
			: [];
	return {
		id: "location",
		title: "Location",
		tone: toneFor(location.state, health.settingUp),
		figure: known
			? `${coordinate(location.latitude as number)}, ${coordinate(location.longitude as number)}`
			: location.state === "unknown"
				? NOT_KNOWN
				: null,
		details,
		problem: failing ? copyFor({ kind: "location" }) : null,
		meter: null,
		actions: [{ kind: "edit-location", primary: failing }],
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
	const { ageSeconds } = health.checks.backups;
	const base = { id: "backups" as const, title: "Backups", meter: null };
	if (health.settingUp)
		return {
			...base,
			tone: "setup",
			figure: null,
			details: [],
			problem: {
				title: "Bring over your old station (optional)",
				detail:
					"Restore a backup from your old station to keep every detection, review and setting.",
			},
			actions: [setting("data", "Restore a backup", false)],
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
			actions: [{ kind: "download-backup" }],
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
					detail: "Download a fresh one to keep recent detections safe.",
				}
			: null,
		actions: [{ kind: "download-backup" }],
	};
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
		actions: failing ? [setting("storage", "Storage settings", true)] : [],
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
	if (updates.state === "updating")
		return {
			...base,
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
			...base,
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
			...base,
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
		...base,
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
