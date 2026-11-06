import "@tanstack/react-start/server-only";

import { spawn } from "node:child_process";

import type { ServiceState } from "./health-data.ts";
import type { StationStatus } from "./station-status.ts";

const LIVE_SERVICES = ["birdnet_recording.service", "birdnet_analysis.service"];

const ANALYZER_SERVICE = "birdnet_analysis.service";

const TIMEOUT_MS = 3_000;

export function readAnalyzerState(): Promise<ServiceState | null> {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (state: ServiceState | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(state);
		};

		let child: ReturnType<typeof spawn>;
		try {
			child = spawn(
				"systemctl",
				["show", ANALYZER_SERVICE, "--property=LoadState,ActiveState"],
				{
					shell: false,
					stdio: ["ignore", "pipe", "ignore"],
					windowsHide: true,
				},
			);
		} catch {
			resolve(null);
			return;
		}
		const timer = setTimeout(() => {
			child.kill();
			finish(null);
		}, TIMEOUT_MS);
		let output = "";
		child.stdout?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => {
			output += chunk;
		});
		child.once("error", () => finish(null));
		child.once("close", (code) => {
			const loadState = /^LoadState=(.+)$/m.exec(output)?.[1]?.trim();
			const activeState = /^ActiveState=(.+)$/m.exec(output)?.[1]?.trim();
			finish(
				code === 0 && loadState && activeState
					? { loadState, activeState }
					: null,
			);
		});
	});
}

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
