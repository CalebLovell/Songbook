import "@tanstack/react-start/server-only";

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { RESETTABLE_CARDS, type SettingsCardKind } from "./settings-data.ts";

export type SettingsCommandRunner = (
	executable: string,
	args: readonly string[],
	stdin?: string,
) => Promise<void>;

export type SettingsSystemContext = {
	previousTimezone?: string;
	timezone?: string;
	timezoneFileExists?: boolean;
	skipSystemActions?: boolean;
};

const SERVICES = {
	station: ["birdnet_analysis.service"],
	detection: ["birdnet_analysis.service"],
	audio: ["birdnet_recording.service", "livestream.service"],
	recording: ["birdnet_recording.service", "birdnet_analysis.service"],
	storage: [],
	review: [],
	highlights: [],
	artwork: [],
	updates: [],
} as const satisfies Record<SettingsCardKind, readonly string[]>;

const defaultRunner: SettingsCommandRunner = (executable, args, stdin) =>
	new Promise((resolve, reject) => {
		const child = spawn(executable, [...args], {
			shell: false,
			stdio: [stdin === undefined ? "ignore" : "pipe", "ignore", "ignore"],
			windowsHide: true,
		});
		child.once("error", reject);
		child.once("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error("System action failed"));
		});
		if (stdin !== undefined) child.stdin?.end(stdin);
	});

function servicesFor(card?: SettingsCardKind): string[] {
	return card
		? [...SERVICES[card]]
		: [...new Set(RESETTABLE_CARDS.flatMap((kind) => SERVICES[kind]))];
}

function skipRequested(context: SettingsSystemContext) {
	return (
		context.skipSystemActions === true ||
		process.env.BIRDNET_SKIP_SYSTEM_ACTIONS === "1"
	);
}

export async function restartServices(
	card?: SettingsCardKind,
	context: SettingsSystemContext = {},
	runner: SettingsCommandRunner = defaultRunner,
) {
	const services = servicesFor(card);
	if (services.length === 0) return { attempted: false, skipped: false };
	if (skipRequested(context)) return { attempted: false, skipped: true };
	await runner("sudo", ["systemctl", "restart", ...services]);
	return { attempted: true, skipped: false };
}

export async function runCardSystemActions(
	kind: SettingsCardKind,
	context: SettingsSystemContext = {},
	runner: SettingsCommandRunner = defaultRunner,
) {
	const timezoneChanges =
		kind === "station" &&
		context.timezone !== undefined &&
		context.timezone !== context.previousTimezone;
	const hasActions = timezoneChanges || servicesFor(kind).length > 0;
	if (skipRequested(context)) return { attempted: false, skipped: hasActions };

	let attempted = false;
	if (timezoneChanges) {
		attempted = true;
		await runner("sudo", [
			"timedatectl",
			"set-timezone",
			context.timezone as string,
		]);
		if (context.timezoneFileExists ?? existsSync("/etc/timezone"))
			await runner(
				"sudo",
				["tee", "/etc/timezone"],
				`${context.timezone as string}\n`,
			);
	}
	const restart = await restartServices(kind, context, runner);
	return { attempted: attempted || restart.attempted, skipped: false };
}
