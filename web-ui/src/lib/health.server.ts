import "@tanstack/react-start/server-only";

import { statfs } from "node:fs/promises";

import { extractedDir } from "~/lib/audio.server.ts";
import type { StationHealth } from "~/lib/health-data.ts";

async function diskUsedPercent(): Promise<number | null> {
	try {
		const stats = await statfs(extractedDir());
		const total = stats.blocks * stats.bsize;
		const free = stats.bavail * stats.bsize;
		if (!(total > 0)) return null;
		return ((total - free) / total) * 100;
	} catch {
		return null;
	}
}

export async function loadStationHealth(): Promise<StationHealth> {
	return { diskUsedPercent: await diskUsedPercent() };
}
