import "@tanstack/react-start/server-only";

import { spawn } from "node:child_process";

import type { StationStatus } from "./station-status.ts";

const LIVE_SERVICES = ["birdnet_recording.service", "birdnet_analysis.service"];

const TIMEOUT_MS = 3_000;

export function readStationStatus(): Promise<StationStatus> {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (status: StationStatus) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(status);
		};

		let child: ReturnType<typeof spawn>;
		try {
			child = spawn("systemctl", ["is-active", "--quiet", ...LIVE_SERVICES], {
				shell: false,
				stdio: "ignore",
				windowsHide: true,
			});
		} catch {
			resolve("unknown");
			return;
		}
		const timer = setTimeout(() => {
			child.kill();
			finish("unknown");
		}, TIMEOUT_MS);
		child.once("error", () => finish("unknown"));
		child.once("exit", (code) => finish(code === 0 ? "live" : "offline"));
	});
}
