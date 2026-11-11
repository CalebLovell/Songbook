import "@tanstack/react-start/server-only";

import { execFile } from "node:child_process";

import {
	type PiReadings,
	parseThrottled,
	type UnderVoltage,
} from "./health-data.ts";

const TIMEOUT_MS = 3_000;

function readUnderVoltage(): Promise<UnderVoltage | null> {
	return new Promise((resolve) => {
		execFile(
			"vcgencmd",
			["get_throttled"],
			{ timeout: TIMEOUT_MS, windowsHide: true },
			(error, stdout) => resolve(error ? null : parseThrottled(stdout)),
		);
	});
}

export async function readPiReadings(): Promise<PiReadings> {
	return { underVoltage: await readUnderVoltage() };
}
