import "@tanstack/react-start/server-only";

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
	parseUpdateState,
	UNMANAGED_UPDATE_STATE,
	type UpdateState,
} from "./updates-data.ts";

function updateDirectory() {
	return process.env.BIRDNET_UPDATE_DIR;
}

async function readOptional(file: string) {
	try {
		return await readFile(file, "utf8");
	} catch {
		return null;
	}
}

export async function loadUpdateState(
	directory = updateDirectory(),
): Promise<UpdateState> {
	if (!directory) return UNMANAGED_UPDATE_STATE;
	const [installed, status] = await Promise.all([
		readOptional(path.join(directory, "installed.json")),
		readOptional(path.join(directory, "update-status.json")),
	]);
	return parseUpdateState(installed, status);
}

const UNITS = {
	check: "birdnet_update_check.service",
	install: "birdnet_update_now.service",
} as const;

export async function startUpdater(action: keyof typeof UNITS): Promise<void> {
	if ((await runUnit(UNITS[action], ["--no-block"])) !== 0)
		throw new Error("The updater could not start.");
}

export async function checkForUpdates(): Promise<UpdateState> {
	await runUnit(UNITS.check, []);
	return loadUpdateState();
}

// Doesn't check BIRDNET_SKIP_SYSTEM_ACTIONS: a web UI beside another BirdNET-Pi sets
// that to spare the other project's services, but still updates itself.
function runUnit(unit: string, flags: string[]): Promise<number> {
	if (!updateDirectory())
		return Promise.reject(
			new Error("This copy of the web UI isn't managed by the updater."),
		);
	return new Promise((resolve, reject) => {
		const child = spawn("sudo", ["systemctl", "start", ...flags, unit], {
			shell: false,
			stdio: "ignore",
			windowsHide: true,
		});
		child.once("error", () =>
			reject(new Error("The updater could not start.")),
		);
		child.once("exit", (code) => resolve(code ?? 1));
	});
}
