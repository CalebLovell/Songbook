import "@tanstack/react-start/server-only";

import { spawn } from "node:child_process";

import type { ServiceState } from "./health-data.ts";
import type { StationStatus } from "./station-status.ts";

const LIVE_SERVICES = ["birdnet_recording.service", "birdnet_analysis.service"];

const ANALYZER_SERVICE = "birdnet_analysis.service";

const TIMEOUT_MS = 3_000;

function runSystemctl(
	args: string[],
): Promise<{ code: number | null; output: string } | null> {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (result: { code: number | null; output: string } | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(result);
		};

		let child: ReturnType<typeof spawn>;
		try {
			child = spawn("systemctl", args, {
				shell: false,
				stdio: ["ignore", "pipe", "ignore"],
				windowsHide: true,
			});
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
		child.once("close", (code) => finish({ code, output }));
	});
}

export async function readAnalyzerState(): Promise<ServiceState | null> {
	const result = await runSystemctl([
		"show",
		ANALYZER_SERVICE,
		"--property=LoadState,ActiveState",
	]);
	if (result?.code !== 0) return null;
	const loadState = /^LoadState=(.+)$/m.exec(result.output)?.[1]?.trim();
	const activeState = /^ActiveState=(.+)$/m.exec(result.output)?.[1]?.trim();
	return loadState && activeState ? { loadState, activeState } : null;
}

export async function readStationStatus(): Promise<StationStatus> {
	const result = await runSystemctl(["is-active", "--quiet", ...LIVE_SERVICES]);
	if (!result) return "unknown";
	return result.code === 0 ? "live" : "offline";
}
